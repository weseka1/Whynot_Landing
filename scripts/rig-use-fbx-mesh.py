"""
RIG OBJ — USE FBX MESH (3ra variante)
======================================
Variante mas simple: USA el mesh del FBX directamente (que ya viene
rigeado y con skin weights perfectos de Mixamo) en vez de transferir
los weights al mesh del OBJ.

Cuando usar esta variante:
  - transfer-rig-to-obj.py (proximidad) falla → mono deformado
  - rig-obj-auto-weights.py (bone heat) falla → mono deformado igual
  - El mesh del FBX (post-Mixamo) tiene UVs que mapean correctamente al
    PNG del Meshy AI (lo cual Mixamo PRESERVA por default — solo cambia
    bones, no UVs)

Tradeoff:
  - Pro: cero riesgo de skin issues. Los weights vienen de Mixamo, son
    perfectos.
  - Contra: si Mixamo modifico el mesh (decimation, smooth, etc.) las
    UVs podrian quedar levemente alejadas → la textura aparecer un poco
    desplazada. Pero en la practica Mixamo NO modifica las UVs.

Pipeline:
  1. Importar FBX (mesh + armature + skin + animation, todo de Mixamo)
  2. Reemplazar el material default del FBX por uno con la textura PNG
     del Meshy AI mapeada a UVs (que estan en el mesh del FBX)
  3. Exportar GLB con todo
"""

import bpy
import sys
import os
import math
import argparse


def parse_args():
    if "--" not in sys.argv:
        print("ERROR: faltan args despues de '--'")
        sys.exit(1)
    argv = sys.argv[sys.argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--fbx", required=True)
    p.add_argument("--texture", required=True)
    p.add_argument("--output", required=True)
    return p.parse_args(argv)


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.textures,
                  bpy.data.images, bpy.data.armatures):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def build_textured_material(name, texture_path):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for n in list(nodes):
        nodes.remove(n)
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(texture_path)
    img.pack()
    tex.image = img
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def main():
    args = parse_args()
    print("=" * 60)
    print("RIG — USE FBX MESH DIRECTLY")
    print("=" * 60)

    for path in (args.fbx, args.texture):
        if not os.path.exists(path):
            print(f"ERROR: no encontrado: {path}")
            sys.exit(1)

    print("[1/4] Limpiando escena...")
    clean_scene()

    print("[2/4] Importando FBX (todo: mesh + armature + skin + anim)...")
    bpy.ops.import_scene.fbx(filepath=args.fbx, use_anim=True, global_scale=100.0)
    meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    armatures = [o for o in bpy.context.selected_objects if o.type == "ARMATURE"]
    if not meshes:
        print("ERROR: el FBX no tiene mesh")
        sys.exit(1)
    fbx_mesh = meshes[0]
    print(f"   Mesh: {fbx_mesh.name}, {len(fbx_mesh.data.vertices)} verts, "
          f"UVs: {[uv.name for uv in fbx_mesh.data.uv_layers]}, "
          f"vertex_groups: {len(fbx_mesh.vertex_groups)}")
    if armatures:
        armature = armatures[0]
        print(f"   Armature: {armature.name}, {len(armature.data.bones)} bones")
    else:
        armature = None

    print("[3/4] Reemplazando material por uno con la textura del PNG...")
    mat = build_textured_material("MonkeyTextured", args.texture)
    fbx_mesh.data.materials.clear()
    fbx_mesh.data.materials.append(mat)

    print("[4/4] Push action a NLA + reset pose a REST + pre-rotacion + exportando GLB...")
    if armature is not None:
        # CRITICO: el FBX de Mixamo viene con los pose bones en frame 0 de la
        # animacion (pose "cayendo con brazos abiertos"). Si exportamos asi,
        # las NODE TRANSFORMS de los bones en el GLB quedan en esa pose →
        # antes de que la AnimationMixer arranque, el mesh se renderiza
        # deformado y MissionPillarMonkey calcula el bbox mal.
        # FIX: pushear el active action a un NLA strip (asi se exporta
        # igual via export_nla_strips=True), despues clearear el active
        # action y limpiar todas las pose bone transforms → Blender exporta
        # con bones en REST.
        import mathutils
        if armature.animation_data and armature.animation_data.action:
            action = armature.animation_data.action
            if not armature.animation_data.nla_tracks:
                track = armature.animation_data.nla_tracks.new()
                start_frame = int(action.frame_range[0]) if action.frame_range else 1
                track.strips.new(action.name, start_frame, action)
            armature.animation_data.action = None
        for pbone in armature.pose.bones:
            pbone.matrix_basis = mathutils.Matrix.Identity(4)
        armature.data.pose_position = "REST"
        # Pre-rotacion -90 X (mismo hack que el script de los otros monos):
        # compensa el export_yup=False para que el mono salga Y-up.
        armature.rotation_euler[0] = math.radians(-90)
    bpy.context.view_layer.update()

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=False,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_apply=False,
        export_image_format="AUTO",
        export_yup=False,
        export_nla_strips=True,
    )
    size_mb = os.path.getsize(args.output) / (1024 * 1024)
    print("-" * 60)
    print(f"OK — GLB generado: {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
