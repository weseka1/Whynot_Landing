"""EXTRACT FBX TEXTURE — saca una imagen packed dentro de un FBX a un PNG suelto."""
import bpy
import sys
import os

if "--" not in sys.argv:
    sys.exit(1)
argv = sys.argv[sys.argv.index("--") + 1:]
fbx_path = argv[argv.index("--fbx") + 1]
out_path = argv[argv.index("--out") + 1]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=False)

# Tomar la primera imagen no-default packed
for img in bpy.data.images:
    if img.packed_file and img.size[0] > 0 and "Render" not in img.name and "Viewer" not in img.name:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        img.filepath_raw = out_path
        img.file_format = "PNG"
        img.save()
        print(f"OK: extracted {img.name} ({img.size[0]}x{img.size[1]}) -> {out_path}")
        break
else:
    print("ERROR: no packed image found")
    sys.exit(1)
