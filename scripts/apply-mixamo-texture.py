"""
APPLY MIXAMO TEXTURE — toma el FBX de Mixamo (sin textura) y la PNG base color
de Meshy, los une y exporta un GLB con esqueleto + animacion + textura.

Por que esto funciona: Mixamo preserva los UVs originales del mesh que le
subis. Si el FBX vino del modelo Meshy (mismo mesh con UV map intacto), basta
con asignar la PNG como base color texture al material del mesh — los UVs
mapean la textura sobre el mesh sin necesidad de bake transfer.

Si los UVs NO coinciden (Mixamo a veces los regenera para mallas complejas),
la textura va a salir distorsionada. En ese caso el approach correcto es bake
transfer en Blender con UV1 → UV2 (workflow separado).

Uso:
    "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background \
        --python scripts/apply-mixamo-texture.py -- \
        --fbx "C:/path/to/monozip3d.fbx" \
        --texture "C:/path/to/texture.png" \
        --output "C:/path/to/output.glb"

Notas:
- Se ejecuta con --background (sin UI), exit code 0 si OK.
- Limpia la escena default (cube, light, camera) antes de importar.
- Usa Principled BSDF como shader → roughness 0.85 (no metallic) para look
  organico de tela/piel; ajustar si el mono se ve muy plano/brilloso.
- Export glTF: incluye animaciones del armature, embed la imagen en el GLB.
"""

import bpy
import sys
import os
import argparse


def parse_args():
    """Parsear args despues del separador `--` que Blender pasa a Python."""
    if "--" not in sys.argv:
        print("ERROR: faltan argumentos despues de '--'")
        sys.exit(1)
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--fbx", required=True, help="Path al FBX de Mixamo")
    p.add_argument("--texture", required=True, help="Path a la PNG base color")
    p.add_argument("--output", required=True, help="Path del GLB de salida")
    return p.parse_args(argv)


def clean_scene():
    """Limpiar la escena default — Blender abre con cube+light+camera."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    # Limpiar tambien data huerfana acumulada
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images, bpy.data.armatures):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def import_fbx(path):
    """Importar FBX y devolver (mesh_objects, armature_object)."""
    bpy.ops.import_scene.fbx(
        filepath=path,
        # Mixamo viene en cm; convertir a m para que el GLB use unidades estandar
        # (1 unidad de Blender = 1 metro). Si el modelo sale chico/grande,
        # ajustar global_scale aca.
        global_scale=1.0,
        bake_space_transform=False,
        use_anim=True,
        anim_offset=0.0,
        automatic_bone_orientation=True,
    )
    meshes = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.selected_objects if obj.type == "ARMATURE"]
    armature = armatures[0] if armatures else None
    print(f"  → Imported {len(meshes)} mesh(es), {len(armatures)} armature(s)")
    return meshes, armature


def build_textured_material(name, texture_path):
    """Crear un material PBR con la PNG como base color.

    Usa node tree (Principled BSDF + Image Texture conectado al Base Color).
    Roughness 0.85 / metallic 0 → look organico (tela, piel, mate); ajustar
    si el mono se ve muy plano o muy brilloso al renderizar.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Limpiar nodos default
    for n in list(nodes):
        nodes.remove(n)

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")

    # Cargar imagen — packed para que el GLB embeba la textura (sin path externo)
    img = bpy.data.images.load(texture_path)
    img.pack()
    tex.image = img

    # Conexiones: TexImage.Color → BSDF.Base Color; BSDF.BSDF → Output.Surface
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0

    # Layout visual de los nodos (cosmetico — para si abris el .blend despues)
    output.location = (400, 0)
    bsdf.location = (100, 0)
    tex.location = (-300, 0)

    return mat


def apply_material_to_meshes(meshes, material):
    """Asignar el material a todos los mesh objects. Reemplaza los slots
    existentes para que el render use solo este material — Mixamo a veces
    deja un material gris default que confunde el resultado."""
    for mesh in meshes:
        # Vaciar slots existentes
        mesh.data.materials.clear()
        # Asignar el nuevo
        mesh.data.materials.append(material)


def export_glb(path, armature):
    """Export glTF 2.0 binario con animaciones embebidas.

    Flags clave:
      - export_format='GLB'     → binario unico, no .gltf + .bin separados
      - export_animations=True  → incluye los clips del armature
      - export_skins=True       → preserva el skin binding mesh↔huesos
      - export_apply=False      → no aplicar modifiers (Mixamo no usa)
      - export_image_format='AUTO' → mantiene PNG packed dentro del GLB
    """
    # Seleccionar todo para que Blender exporte la escena completa
    bpy.ops.object.select_all(action="SELECT")

    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,  # exportar toda la escena
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_apply=False,
        export_image_format="AUTO",
        export_yup=True,  # convencion glTF: Y up (en Blender es Z up)
        export_def_bones=False,
        export_nla_strips=True,
    )
    print(f"  → Exported GLB to {path}")


def main():
    args = parse_args()

    print("=" * 60)
    print("APPLY MIXAMO TEXTURE")
    print("=" * 60)
    print(f"FBX:     {args.fbx}")
    print(f"Texture: {args.texture}")
    print(f"Output:  {args.output}")
    print("-" * 60)

    if not os.path.exists(args.fbx):
        print(f"ERROR: FBX no encontrado: {args.fbx}")
        sys.exit(1)
    if not os.path.exists(args.texture):
        print(f"ERROR: Textura no encontrada: {args.texture}")
        sys.exit(1)

    print("[1/4] Limpiando escena…")
    clean_scene()

    print("[2/4] Importando FBX de Mixamo…")
    meshes, armature = import_fbx(args.fbx)
    if not meshes:
        print("ERROR: el FBX no contiene meshes")
        sys.exit(1)

    print("[3/4] Aplicando textura PNG como base color…")
    mat = build_textured_material("MonkeyTextured", args.texture)
    apply_material_to_meshes(meshes, mat)

    print("[4/4] Exportando GLB con animaciones…")
    # Asegurar que el directorio destino existe
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    export_glb(args.output, armature)

    size_mb = os.path.getsize(args.output) / (1024 * 1024)
    print("-" * 60)
    print(f"OK — GLB generado: {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
