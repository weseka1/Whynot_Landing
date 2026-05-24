"""COMPARE UVS — diagnostico: comparar los UVs entre un OBJ y un FBX
para detectar si Mixamo regenero los UVs durante el auto-rigging."""
import bpy
import sys

if "--" not in sys.argv:
    print("ERROR: pasar --obj PATH --fbx PATH despues de --")
    sys.exit(1)
argv = sys.argv[sys.argv.index("--") + 1:]
obj_path = argv[argv.index("--obj") + 1]
fbx_path = argv[argv.index("--fbx") + 1]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

print("=" * 60)
print("OBJ:", obj_path)
bpy.ops.wm.obj_import(filepath=obj_path)
obj_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
for m in obj_meshes:
    print(f"  {m.name}: verts={len(m.data.vertices)} polys={len(m.data.polygons)}")
    for uv in m.data.uv_layers:
        uvs = [(loop.uv.x, loop.uv.y) for loop in uv.data[:5]]
        print(f"  UV layer '{uv.name}': first 5 uvs = {uvs}")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

print("-" * 60)
print("FBX:", fbx_path)
bpy.ops.import_scene.fbx(filepath=fbx_path)
fbx_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
for m in fbx_meshes:
    print(f"  {m.name}: verts={len(m.data.vertices)} polys={len(m.data.polygons)}")
    for uv in m.data.uv_layers:
        uvs = [(loop.uv.x, loop.uv.y) for loop in uv.data[:5]]
        print(f"  UV layer '{uv.name}': first 5 uvs = {uvs}")
print("=" * 60)
