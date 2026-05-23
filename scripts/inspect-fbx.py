"""INSPECT FBX — diagnostico rapido: que animaciones, frames y bones trae el FBX."""
import bpy
import sys

if "--" not in sys.argv:
    print("ERROR: pasar --fbx PATH despues de --")
    sys.exit(1)
argv = sys.argv[sys.argv.index("--") + 1:]
fbx_path = argv[argv.index("--fbx") + 1]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=True)

print("=" * 60)
print("FBX INSPECTION")
print("=" * 60)
print(f"Scene frame_start: {bpy.context.scene.frame_start}")
print(f"Scene frame_end:   {bpy.context.scene.frame_end}")
print(f"Scene FPS:         {bpy.context.scene.render.fps}")
print()

for obj in bpy.data.objects:
    print(f"Object: {obj.name} (type={obj.type})")
    if obj.type == "ARMATURE":
        print(f"  Bones: {len(obj.data.bones)}")
        if obj.animation_data and obj.animation_data.action:
            act = obj.animation_data.action
            print(f"  Action: {act.name}")
            print(f"  Action frame_range: {act.frame_range[0]} → {act.frame_range[1]}")
            print(f"  Action fcurves: {len(act.fcurves)}")
        else:
            print("  NO ACTION")
    if obj.type == "MESH":
        print(f"  Vertices: {len(obj.data.vertices)}")
        print(f"  UV maps:  {[uv.name for uv in obj.data.uv_layers]}")

print()
print("ALL ACTIONS:")
for act in bpy.data.actions:
    print(f"  {act.name}: frames {act.frame_range[0]} → {act.frame_range[1]} ({len(act.fcurves)} fcurves)")

print("=" * 60)
