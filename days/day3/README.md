# Storage and configuration

This day is about keeping important values outside the container image.

You will learn how to:
- keep settings in ConfigMaps
- keep passwords and keys in Secrets
- keep data in persistent volumes
- use StatefulSets for stateful apps
- make containers safer with a security context

How to use this folder:
1. Open the first lab and read it carefully.
2. Apply the manifest in that lab's `manifests/` folder.
3. Check the result with `kubectl`.
4. Run the lab validation command.
5. Move to the next lab when the check passes.

Use these commands when you are ready:
- `make validate-lab LAB=L3.1`
- `make validate-day3`
