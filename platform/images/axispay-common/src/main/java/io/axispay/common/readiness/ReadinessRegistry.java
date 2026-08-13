package io.axispay.common.readiness;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Readiness, liveness and startup — the three probes, and why they differ.
 *
 * <p>This encodes the single most important operational distinction in the
 * course. Students meet it on Day 2 (M2.3), but the code exists from Day 1 so
 * they can read it before they need it.
 *
 * <ul>
 *   <li><b>LIVENESS</b> "Is this process broken beyond recovery?" Failure =&gt;
 *       kubelet RESTARTS the container. MUST NOT check dependencies, or a brief
 *       dependency blip would restart every replica at once — a cascading
 *       failure. {@link #live()} therefore returns true unconditionally.</li>
 *   <li><b>READINESS</b> "Can THIS instance serve a request right now?" Failure
 *       =&gt; pod removed from Service Endpoints; traffic stops; no restart.
 *       SHOULD check dependencies — that is the point.</li>
 *   <li><b>STARTUP</b> "Has initialisation finished?" Failure =&gt; kubelet keeps
 *       waiting and liveness is suspended until it passes.</li>
 * </ul>
 */
public class ReadinessRegistry {

    /** A dependency check: returns true when the dependency is healthy. */
    @FunctionalInterface
    public interface Check {
        boolean run() throws Exception;
    }

    private record Registration(Check check, boolean critical) {
    }

    private final Map<String, Registration> checks = new LinkedHashMap<>();
    private final long startedAtNanos = System.nanoTime();
    private final double startupDelaySeconds;
    private volatile boolean startupComplete;
    private volatile boolean forcedUnready = false;
    private final ExecutorService pool = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "readiness-check");
        t.setDaemon(true);
        return t;
    });

    public ReadinessRegistry(double startupDelaySeconds) {
        this.startupDelaySeconds = startupDelaySeconds;
        this.startupComplete = startupDelaySeconds <= 0;
    }

    // -- registration --------------------------------------------------------

    /**
     * Register a dependency. A non-critical dependency degrades the service but
     * does not make it unready — e.g. Redis being down slows fraud scoring but
     * payments still work, so it is registered non-critical and the pod keeps
     * serving. Graceful degradation, expressed in code.
     */
    public void register(String name, Check check, boolean critical) {
        checks.put(name, new Registration(check, critical));
    }

    // -- the three probes ----------------------------------------------------

    /** Liveness. Deliberately unconditional. See the class docstring. */
    public boolean live() {
        return true;
    }

    public boolean startup() {
        if (!startupComplete && uptimeSeconds() >= startupDelaySeconds) {
            startupComplete = true;
        }
        return startupComplete;
    }

    public record ReadyResult(boolean ok, Map<String, String> detail) {
    }

    public ReadyResult ready() {
        if (forcedUnready) {
            return new ReadyResult(false, Map.of("_forced", "unready (set via /api/v1/_admin/unready)"));
        }
        if (!startup()) {
            return new ReadyResult(false, Map.of("_startup", "initialising"));
        }

        Map<String, String> detail = new LinkedHashMap<>();
        boolean anyCriticalFailed = false;
        Map<String, Future<Boolean>> futures = new LinkedHashMap<>();
        for (var entry : checks.entrySet()) {
            futures.put(entry.getKey(), submit(entry.getValue().check()));
        }
        for (var entry : checks.entrySet()) {
            String name = entry.getKey();
            boolean critical = entry.getValue().critical();
            boolean ok = await(futures.get(name));
            detail.put(name, ok ? "ok" : (critical ? "failed" : "degraded"));
            if (!ok && critical) {
                anyCriticalFailed = true;
            }
        }
        return new ReadyResult(!anyCriticalFailed, detail);
    }

    private Future<Boolean> submit(Check check) {
        Callable<Boolean> task = () -> {
            try {
                return check.run();
            } catch (Exception e) {
                return false;
            }
        };
        return pool.submit(task);
    }

    private boolean await(Future<Boolean> future) {
        try {
            return Boolean.TRUE.equals(future.get(2, TimeUnit.SECONDS));
        } catch (Exception e) {
            future.cancel(true);
            return false;
        }
    }

    // -- lab controls --------------------------------------------------------

    /**
     * Lets students take one pod out of a Service without deleting it, and watch
     * Endpoints change live. Used in L2.3.
     */
    public void forceUnready(boolean value) {
        this.forcedUnready = value;
    }

    public double uptimeSeconds() {
        return (System.nanoTime() - startedAtNanos) / 1_000_000_000.0;
    }
}
