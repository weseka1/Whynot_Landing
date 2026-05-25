"""
TRANSFER RIG TO OBJ — toma el armature+animacion de un FBX de Mixamo y se
los aplica al mesh de un OBJ (con sus UVs+textura originales intactos).

Caso de uso: cuando el FBX que se subio a Mixamo tiene un MESH DISTINTO al
que tenes el OBJ con textura correcta. La PNG de Meshy mapea a los UVs del
OBJ; si se la aplicas al mesh del FBX (cuyos UVs son distintos), aparecen
manchas. Este script invierte el flujo:
  - Usa el mesh del OBJ (UVs correctos, textura correcta)
  - Le transfiere los weights del rig del FBX (por proximidad de vertices)
  - Asigna el armature modifier al OBJ_mesh
  - Exporta GLB con animaciones del armature + textura limpia

Tecnica de scaling: usa object.scale + transform_apply (idiomatic Blender),
no modifica mesh.data.vertices directamente (eso causa bbox=0 al exportar).
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
    """Devuelve el bbox WORLD-SPACE de un object como (min_v, max_v, size_v)."""
    bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    min_v = Vector((min(b.x for b in bbox), min(b.y for b in bbox), min(b.z for b in bbox)))
    max_v = Vector((max(b.x for b in bbox), max(b.y for b in bbox), max(b.z for b in bbox)))
    return min_v, max_v, max_v - min_v


def main():
    args = parse_args()
    print("=" * 60)
    print("TRANSFER RIG TO OBJ")
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

    print("[1/8] Limpiando escena...")
    clean_scene()

    print("[2/8] Importando OBJ (mesh con UVs+textura originales)...")
    # Meshy OBJ uses Y-up convention. Blender es Z-up. Forzamos la conversion
    # para que el modelo quede parado correctamente. Sin esto, el modelo
    # queda acostado y al export GLB queda con altura en eje equivocado
    # (el componente normaliza por size.y, asi que con eje malo da bbox
    # de proporciones invertidas y se ve girado en pantalla).
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
          f"bbox {obj_size.x:.2f}x{obj_size.y:.2f}x{obj_size.z:.2f}, "
          f"UVs: {[uv.name for uv in target_mesh.data.uv_layers]}")

    print("[3/8] Importando FBX (armature + mesh source)...")
    # global_scale=100 → Mixamo guarda FBX en cm pero el import de Blender
    # los lee como unidades arbitrarias (resulta en bbox ~0.02). Multiplicar
    # ×100 los pone en metros (~1.8m alto), misma escala que el OBJ. Si no
    # se hace esto, todo el pipeline termina colapsado en escala microscopio
    # y el GLB exportado tiene bbox ~0.0001 (mono invisible al renderizar).
    bpy.ops.import_scene.fbx(filepath=args.fbx, use_anim=True, global_scale=100.0)
    fbx_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    fbx_armatures = [o for o in bpy.context.selected_objects if o.type == "ARMATURE"]
    if not fbx_meshes or not fbx_armatures:
        print("ERROR: el FBX necesita mesh + armature")
        sys.exit(1)
    source_mesh = fbx_meshes[0]
    source_mesh.name = "SourceMesh"
    armature = fbx_armatures[0]
    _, _, fbx_size = world_bbox_size(source_mesh)
    print(f"   {source_mesh.name}: {len(source_mesh.data.vertices)} verts, "
          f"bbox {fbx_size.x:.2f}x{fbx_size.y:.2f}x{fbx_size.z:.2f}")
    print(f"   {armature.name}: {len(armature.data.bones)} bones")

    print("[4/8] Escalar OBJ al tamaño del FBX (Z axis match) + centrar...")
    # Algunos FBX de Mixamo (no todos) vienen con el mesh offset en Z (lejos
    # del armature). Antes el script centraba el OBJ AL FBX-mesh-center,
    # entonces si el FBX-mesh estaba offset, el OBJ se iba con el → al
    # animar (armature en origen, mesh lejos) salia roto/enorme.
    # Fix: NO usar fbx_center; mover el OBJ y el FBX-mesh AMBOS al origen.
    # La proximidad sigue funcionando porque ahora estan ambos en el mismo
    # spot (origen). El armature (en origen) tambien queda alineado.
    if obj_size.z > 0 and fbx_size.z > 0:
        scale_factor = fbx_size.z / obj_size.z
        target_mesh.scale = (scale_factor, scale_factor, scale_factor)
        print(f"   scale_factor = {scale_factor:.4f}")
    bpy.context.view_layer.update()

    obj_min, obj_max, _ = world_bbox_size(target_mesh)
    obj_center = (obj_min + obj_max) / 2
    target_mesh.location -= obj_center
    fbx_min, fbx_max, _ = world_bbox_size(source_mesh)
    fbx_center = (fbx_min + fbx_max) / 2
    source_mesh.location -= fbx_center
    bpy.context.view_layer.update()

    # Apply transform → vertices del OBJ quedan a la misma escala/posicion
    # que los del FBX en world space. Idiomatic Blender (object.scale +
    # transform_apply), no modifica mesh.data.vertices directamente (eso
    # causa bbox=0 al exportar GLB).
    bpy.ops.object.select_all(action="DESELECT")
    target_mesh.select_set(True)
    bpy.context.view_layer.objects.active = target_mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    _, _, post_size = world_bbox_size(target_mesh)
    print(f"   post-scale bbox: {post_size.x:.2f}x{post_size.y:.2f}x{post_size.z:.2f}")

    print("[5/8] Crear vertex groups vacios en target...")
    for vg in source_mesh.vertex_groups:
        if vg.name not in target_mesh.vertex_groups:
            target_mesh.vertex_groups.new(name=vg.name)
    print(f"   {len(target_mesh.vertex_groups)} vertex groups creados")

    print("[6/8] Data Transfer modifier — copiar weights por proximidad...")
    bpy.ops.object.select_all(action="DESELECT")
    target_mesh.select_set(True)
    bpy.context.view_layer.objects.active = target_mesh

    mod = target_mesh.modifiers.new(name="DataTransfer", type="DATA_TRANSFER")
    mod.object = source_mesh
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"
    mod.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.datalayout_transfer(modifier="DataTransfer")
    bpy.ops.object.modifier_apply(modifier="DataTransfer")
    print(f"   {len(target_mesh.vertex_groups)} vertex groups con weights")

    print("[7/8] Asignar armature modifier al OBJ + parent + material...")
    # Armature modifier para que el skinning funcione
    arm_mod = target_mesh.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = armature
    # Parent al armature SIN regenerar weights (los vertex groups ya estan)
    target_mesh.parent = armature
    target_mesh.parent_type = "OBJECT"
    # Material con la textura correcta (la que mapea a los UVs del OBJ)
    mat = build_textured_material("MonkeyTextured", args.texture)
    target_mesh.data.materials.clear()
    target_mesh.data.materials.append(mat)
    # Borrar el FBX mesh (ya transferimos lo que necesitabamos)
    bpy.ops.object.select_all(action="DESELECT")
    source_mesh.select_set(True)
    bpy.ops.object.delete(use_global=False)

    print("[8/8] Pre-rotacion + exportando GLB...")
    # Pre-rotar el armature (parent de todo) -90 X → en world space el modelo
    # queda con Y como altura (glTF estandar). Solo modificamos rotation_euler
    # del armature object (NO transform_apply) → los children rotan en world
    # pero el bind pose interno del skeleton se preserva. Eso solo cambia el
    # node matrix del armature en el glTF, three.js lo aplica al renderizar.
    # Combinado con export_yup=False (no doble rotacion), el GLB queda Y-up.
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
