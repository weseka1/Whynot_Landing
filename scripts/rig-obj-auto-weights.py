"""
RIG OBJ — AUTO WEIGHTS variant
==============================
Alternativa robusta al transfer-rig-to-obj.py original (que usa Data Transfer
por proximidad del mesh del FBX). Cuando el mesh del OBJ y el del FBX
divergen en geometria (ej: el OBJ es muy "delgado" comparado al del FBX
porque Mixamo modifico el mesh al rigear), el transfer por proximidad asigna
los weights a bones equivocados → la animacion deforma los vertices.

Esta variante NO usa el mesh del FBX como source. En su lugar:
  - Importa el OBJ con la textura correcta
  - Importa solo el ARMATURE del FBX (descarta su mesh)
  - Hace parent del OBJ al armature con type='ARMATURE_AUTO'
    → Blender computa los weights con bone heat / envelope-based
      directamente desde la estructura del armature, NO de un mesh externo
  - Aplica la textura correcta al OBJ
  - Exporta GLB con animacion

Cuando usar esta variante:
  - El mono se ve "deformado" (vertices estirados) al animar
  - El OBJ y el FBX-mesh tienen bbox muy distintos (X o Y much diff)
  - Mixamo modifico significativamente el mesh durante el rig

Cuando usar el script original (transfer-rig-to-obj.py):
  - OBJ y FBX-mesh son muy similares en geometria
  - Es la primera opcion (la mas rapida)
  - Si funciona, queda mejor (weights mas precisos)
"""

import bpy
import sys
import os
import math
import argparse
from mathutils import Vector


def parse_args():
    if "--" not in sys.argv:
        print("ERROR: faltan args despues de '--'")
        sys.exit(1)
    argv = sys.argv[sys.argv.index("--") + 1:]
    p = argparse.ArgumentParser()
    p.add_argument("--obj", required=True)
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


def world_bbox_size(obj):
    bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(b.x for b in bbox), min(b.y for b in bbox), min(b.z for b in bbox)))
    max_v = Vector((max(b.x for b in bbox), max(b.y for b in bbox), max(b.z for b in bbox)))
    return min_v, max_v, max_v - min_v


def main():
    args = parse_args()
    print("=" * 60)
    print("RIG OBJ — AUTO WEIGHTS")
    print("=" * 60)
    print(f"OBJ:      {args.obj}")
    print(f"FBX:      {args.fbx}")
    print(f"Texture:  {args.texture}")
    print(f"Output:   {args.output}")
    print("-" * 60)

    for path in (args.obj, args.fbx, args.texture):
        if not os.path.exists(path):
            print(f"ERROR: no encontrado: {path}")
            sys.exit(1)

    print("[1/7] Limpiando escena...")
    clean_scene()

    print("[2/7] Importando OBJ (mesh + UVs + textura)...")
    bpy.ops.wm.obj_import(
        filepath=args.obj,
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )
    obj_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if not obj_meshes:
        print("ERROR: el OBJ no tiene mesh")
        sys.exit(1)
    target_mesh = obj_meshes[0]
    target_mesh.name = "TargetMesh"
    _, _, obj_size = world_bbox_size(target_mesh)
    print(f"   {target_mesh.name}: {len(target_mesh.data.vertices)} verts, "
          f"bbox {obj_size.x:.2f}x{obj_size.y:.2f}x{obj_size.z:.2f}")

    print("[3/7] Importando FBX (armature solo — descartamos el mesh)...")
    bpy.ops.import_scene.fbx(filepath=args.fbx, use_anim=True, global_scale=100.0)
    fbx_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    fbx_armatures = [o for o in bpy.context.selected_objects if o.type == "ARMATURE"]
    if not fbx_armatures:
        print("ERROR: el FBX necesita armature")
        sys.exit(1)
    armature = fbx_armatures[0]
    print(f"   {armature.name}: {len(armature.data.bones)} bones")

    # Get FBX mesh size BEFORE deleting it (for scaling reference)
    fbx_size = Vector((1, 1, 1))
    if fbx_meshes:
        source_mesh = fbx_meshes[0]
        _, _, fbx_size = world_bbox_size(source_mesh)
        print(f"   FBX mesh (sera descartado): {len(source_mesh.data.vertices)} verts, "
              f"bbox {fbx_size.x:.2f}x{fbx_size.y:.2f}x{fbx_size.z:.2f}")
        # Borrar el mesh del FBX — NO lo usamos como source de weights
        bpy.ops.object.select_all(action="DESELECT")
        source_mesh.select_set(True)
        bpy.ops.object.delete(use_global=False)

    print("[4/7] Escalar OBJ al tamaño del armature (Z axis) + centrar...")
    if obj_size.z > 0 and fbx_size.z > 0:
        scale_factor = fbx_size.z / obj_size.z
        target_mesh.scale = (scale_factor, scale_factor, scale_factor)
        print(f"   scale_factor = {scale_factor:.4f}")
    bpy.context.view_layer.update()
    obj_min, obj_max, _ = world_bbox_size(target_mesh)
    obj_center = (obj_min + obj_max) / 2
    # Centro del armature en su rest pose
    arm_min = Vector((min(b.head_local.x for b in armature.data.bones),
                      min(b.head_local.y for b in armature.data.bones),
                      min(b.head_local.z for b in armature.data.bones)))
    arm_max = Vector((max(b.head_local.x for b in armature.data.bones),
                      max(b.head_local.y for b in armature.data.bones),
                      max(b.head_local.z for b in armature.data.bones)))
    arm_center_local = (arm_min + arm_max) / 2
    arm_center_world = armature.matrix_world @ arm_center_local
    target_mesh.location += arm_center_world - obj_center
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action="DESELECT")
    target_mesh.select_set(True)
    bpy.context.view_layer.objects.active = target_mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    _, _, post_size = world_bbox_size(target_mesh)
    print(f"   post-scale bbox: {post_size.x:.2f}x{post_size.y:.2f}x{post_size.z:.2f}")

    print("[5/7] Parent OBJ al armature con AUTOMATIC WEIGHTS...")
    # parent_set(type='ARMATURE_AUTO') = Ctrl+P → Armature Deform → With
    # Automatic Weights. Blender computa los weights con bone heat,
    # directamente desde la estructura del armature (NO desde otro mesh).
    # Robusto cuando el mesh y el FBX-mesh tienen geometrias distintas.
    bpy.ops.object.select_all(action="DESELECT")
    target_mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    bpy.context.view_layer.update()
    print(f"   {len(target_mesh.vertex_groups)} vertex groups generados con bone heat")

    print("[6/7] Aplicar textura al OBJ...")
    mat = build_textured_material("MonkeyTextured", args.texture)
    target_mesh.data.materials.clear()
    target_mesh.data.materials.append(mat)

    print("[7/7] Pre-rotacion + exportando GLB...")
    # Mismo treatment que el script original: -90° X en el armature →
    # en world space el modelo queda Y-up (estandar glTF). three.js lo
    # respeta al renderizar.
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
