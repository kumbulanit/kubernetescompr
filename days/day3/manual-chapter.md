# Day 3 — Storage and configuration

This day is about keeping important values outside the container image.

The main ideas are simple:
- use ConfigMaps for settings that change often
- use Secrets for passwords and keys
- use persistent volumes when data must survive a restart
- use StatefulSets for apps that need stable identity and storage
- use a security context to make containers safer

For every lab in this day:
1. Read the lab README.
2. Open the `manifests/` folder.
3. Apply the YAML.
4. Check the object with `kubectl`.
5. Run the validation command.
