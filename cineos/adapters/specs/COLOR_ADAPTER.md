# ACES / AMF / CLF Adapter Specification

CineOS owns a neutral `ColorPipeline` object.

Adapters may export:
- AMF sidecar for ACES viewing pipeline metadata
- CLF references for look transforms

Do not make AMF the project database.

Store:
- transform identifiers
- source file checksums
- display target
- version
- provenance

Color implementation should rely on standards-compliant libraries/configurations rather than ad hoc transform math.
