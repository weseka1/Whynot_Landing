"""
TRANSFER RIG TO OBJ — fix para cuando Mixamo regenera los UVs del mesh.

Problema: cuando subis un OBJ a Mixamo, Mixamo a veces re-meshea (refina/
optimiza la topologia) para hacer auto-rig. El mesh resultante tiene UVs
DISTINTOS del OBJ original. Al aplicar la PNG-atlas de Meshy (texturizada
para los UVs originales) al mesh re-meshado del FBX, los chunks de
textura terminan en partes incorrectas → mono "manchado".

Solucion: usar el mesh ORIGINAL del OBJ (que tiene UVs correctos +
textura mapeada bien) Y transferirle el rigging del FBX.

Flujo:
  1. Import OBJ — mesh con UVs+textura buenos, sin rigging
  2. Import FBX — armature + mesh re-meshado con weights
  3. Data Transfer modifier: copiar vertex weights del FBX_mesh al OBJ_mesh
  4. Asignar el armature modifier al OBJ_mesh y parente al armature
  5. Borrar el FBX_mesh (ya no se necesita)
  6. Export GLB con animaciones del armature + mesh original con textura

Uso:
    blender --background --python scripts/transfer-rig-to-obj.py -- \
        --obj <path/to/mesh.obj> \
        --fbx <path/to/rigged.fbx> \
        --texture <path/to/texture.png> \
        --output <path/to/output.glb>
"""

import bpy
import sys
import os
import argparse


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
    """Material PBR con la PNG como base color. Roughness alta = look mate."""
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

    print("[1/7] Limpiando escena...")
    clean_scene()

    print("[2/7] Importando OBJ (mesh con UVs originales)...")
    bpy.ops.wm.obj_import(filepath=args.obj)
    obj_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if not obj_meshes:
        print("ERROR: el OBJ no tiene mesh")
        sys.exit(1)
    target_mesh = obj_meshes[0]
    target_mesh.name = "TargetMesh"
    print(f"   OBJ mesh: {target_mesh.name} ({len(target_mesh.data.vertices)} verts, "
          f"UV maps: {[uv.name for uv in target_mesh.data.uv_layers]})")

    print("[3/7] Importando FBX (armature + mesh source para weights)...")
    bpy.ops.import_scene.fbx(filepath=args.fbx, use_anim=True)
    fbx_meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    fbx_armatures = [o for o in bpy.context.selected_objects if o.type == "ARMATURE"]
    if not fbx_meshes or not fbx_armatures:
        print("ERROR: el FBX necesita mesh + armature")
        sys.exit(1)
    source_mesh = fbx_meshes[0]
    source_mesh.name = "SourceMesh"
    armature = fbx_armatures[0]
    print(f"   FBX mesh: {source_mesh.name} ({len(source_mesh.data.vertices)} verts)")
    print(f"   Armature: {armature.name} ({len(armature.data.bones)} bones)")

    print("[4/7] Auto-fit del FBX (armature + source_mesh) hacia el OBJ...")
    # CRITICO: escalamos el FBX al tamaño del OBJ (no al reves), porque el
    # OBJ ya esta en escala glTF estandar (metros, ~1.8m de alto). Si
    # escalamos el OBJ hacia el FBX (que viene en cm de Mixamo), el GLB
    # exportado queda gigante respecto a los otros monos del sitio y el
    # auto-fit del componente MissionPillarMonkey lo trata mal.
    import mathutils
    fbx_bbox = [source_mesh.matrix_world @ mathutils.Vector(c)
                for c in source_mesh.bound_box]
    obj_bbox = [target_mesh.matrix_world @ mathutils.Vector(c)
                for c in target_mesh.bound_box]
    fbx_size_z = max(b.z for b in fbx_bbox) - min(b.z for b in fbx_bbox)
    obj_size_z = max(b.z for b in obj_bbox) - min(b.z for b in obj_bbox)
    if fbx_size_z > 0 and obj_size_z > 0:
        scale_factor = obj_size_z / fbx_size_z
        # Escalar el armature (y por jerarquia el source_mesh) hacia escala OBJ
        armature.scale = (scale_factor, scale_factor, scale_factor)
        print(f"   Escalando armature+FBX por {scale_factor:.4f} para "
              f"matchear escala OBJ (~metros)")
    # Centrar el FBX a la misma posicion del OBJ mesh
    bpy.context.view_layer.update()
    fbx_bbox = [source_mesh.matrix_world @ mathutils.Vector(c)
                for c in source_mesh.bound_box]
    obj_center = sum(obj_bbox, mathutils.Vector()) / 8
    fbx_center = sum(fbx_bbox, mathutils.Vector()) / 8
    delta = obj_center - fbx_center
    armature.location += delta
    bpy.context.view_layer.update()

    # Aplicar la transform al armature para que las animaciones queden bakeadas
    # a la nueva escala (sino el armature deform va a aplicar la escala como
    # multiplier sobre el mesh y se rompe el rig al exportar)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    source_mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    print("[5/7] Transfiriendo weights del FBX mesh al OBJ mesh (Data Transfer)...")
    # Data Transfer modifier copia vertex groups por proximidad nearest-face
    # interpolated. El OBJ mesh recibe los mismos vertex groups (uno por bone)
    # que el FBX mesh, mapeados a sus propios vertices.
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

    # Crear vertex groups vacios en el target para que data transfer tenga
    # donde escribir. Copiamos los nombres del source.
    for vg in source_mesh.vertex_groups:
        if vg.name not in target_mesh.vertex_groups:
            target_mesh.vertex_groups.new(name=vg.name)

    # Aplicar el modifier
    bpy.ops.object.datalayout_transfer(modifier="DataTransfer")
    bpy.ops.object.modifier_apply(modifier="DataTransfer")
    print(f"   {len(target_mesh.vertex_groups)} vertex groups transferidos")

    print("[6/7] Asignando armature al OBJ mesh + asignando textura...")
    # Aplicar la escala/rotacion al mesh para que armature deform funcione
    bpy.ops.object.select_all(action="DESELECT")
    target_mesh.select_set(True)
    bpy.context.view_layer.objects.active = target_mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Armature modifier
    arm_mod = target_mesh.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = armature

    # Parente al armature (sin generar nuevos weights — los vertex groups ya
    # estan asignados gracias al Data Transfer)
    target_mesh.parent = armature
    target_mesh.parent_type = "OBJECT"

    # Material con la textura
    mat = build_textured_material("MonkeyTextured", args.texture)
    target_mesh.data.materials.clear()
    target_mesh.data.materials.append(mat)

    # Borrar el FBX mesh (ya transferimos lo que necesitabamos)
    bpy.ops.object.select_all(action="DESELECT")
    source_mesh.select_set(True)
    bpy.ops.object.delete(use_global=False)

    print("[7/7] Exportando GLB...")
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
        export_yup=True,
        export_nla_strips=True,
    )
    size_mb = os.path.getsize(args.output) / (1024 * 1024)
    print("-" * 60)
    print(f"OK — GLB generado: {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
