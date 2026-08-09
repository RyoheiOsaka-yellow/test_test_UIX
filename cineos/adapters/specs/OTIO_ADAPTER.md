# OpenTimelineIO Adapter Specification

## Export
Create editorial timeline objects from CineOS selected shots / takes.

Attach CineOS IDs in metadata.

## Import
On re-import:
- preserve existing Shot identity
- update edit decisions
- create external editorial clip references
- do not overwrite planned shot duration unless explicitly requested

## Metadata
`cineos.project_id`
`cineos.scene_id`
`cineos.shot_id`
`cineos.take_id`
`cineos.media_asset_id`
`cineos.vfx_status`
`cineos.color_pipeline_id`
