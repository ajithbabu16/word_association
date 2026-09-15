import { CutPieceResult } from './shapeUtils';
import { writePsd } from 'ag-psd';

export interface PrefabExportOptions {
  cocosVersion: '3.8.8' | '3.x' | '2.x';
  includeMeta: boolean;
  rootNodeName: string;
  canvasWidth: number;
  canvasHeight: number;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateShortUUID(): string {
  return generateUUID().substring(0, 8);
}

/**
 * Ensures each cut piece has deterministic UUIDs for its Texture and SpriteFrame assets.
 */
export function ensurePieceUuids(
  pieces: CutPieceResult[],
  cocosVersion: '3.8.8' | '3.x' | '2.x' = '3.8.8'
) {
  pieces.forEach((piece) => {
    if (!piece.textureUuid) {
      piece.textureUuid = generateUUID();
    }
    if (!piece.spriteFrameUuid) {
      if (cocosVersion === '2.x') {
        piece.spriteFrameUuid = generateUUID();
      } else {
        piece.spriteFrameUuid = `${piece.textureUuid}@f9941`;
      }
    }
  });
}

/**
 * Generate Cocos Creator 3.8.8 / 3.x Prefab JSON structure.
 */
export function generateCocos3xPrefab(
  pieces: CutPieceResult[],
  options: PrefabExportOptions
) {
  ensurePieceUuids(pieces, options.cocosVersion);

  const rootNodeId = generateShortUUID();
  const nodes: any[] = [];

  // Index 0: cc.Prefab asset wrapper required by Cocos Creator 3.8.x
  nodes.push({
    "__type__": "cc.Prefab",
    "_name": options.rootNodeName || "PrefabRoot",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false
  });

  // Index 1: Root cc.Node (2D UI Layer = 33554432)
  nodes.push({
    "__type__": "cc.Node",
    "_name": options.rootNodeName || "PrefabRoot",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      { "__id__": 2 }
    ],
    "_prefab": {
      "__type__": "cc.PrefabInfo",
      "root": { "__id__": 1 },
      "asset": { "__id__": 0 },
      "fileId": rootNodeId,
      "targetOverrides": null,
      "nestedPrefabInstanceRoots": null
    },
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
      "z": 0
    },
    "_lrot": {
      "__type__": "cc.Quat",
      "x": 0,
      "y": 0,
      "z": 0,
      "w": 1
    },
    "_lscale": {
      "__type__": "cc.Vec3",
      "x": 1,
      "y": 1,
      "z": 1
    },
    "_layer": 33554432
  });

  // Index 2: Root cc.UITransform component
  nodes.push({
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": { "__id__": 1 },
    "_enabled": true,
    "__prefab__": {
      "__type__": "cc.CompPrefabInfo",
      "fileId": generateShortUUID()
    },
    "_contentSize": {
      "__type__": "cc.Size",
      "width": options.canvasWidth,
      "height": options.canvasHeight
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    }
  });

  let currentId = 3;

  // Add child nodes for each shape cut piece
  pieces.forEach((piece) => {
    const nodeIndex = currentId;
    const uiTransformIndex = currentId + 1;
    const spriteIndex = currentId + 2;

    // Convert canvas top-left coordinates to Cocos center-based coordinates
    const cocosX = piece.x + piece.width / 2 - options.canvasWidth / 2;
    const cocosY = options.canvasHeight / 2 - (piece.y + piece.height / 2);

    // Child Node (Attached to Root Node at __id__: 1)
    nodes.push({
      "__type__": "cc.Node",
      "_name": piece.name,
      "_objFlags": 0,
      "_parent": { "__id__": 1 },
      "_children": [],
      "_active": true,
      "_components": [
        { "__id__": uiTransformIndex },
        { "__id__": spriteIndex }
      ],
      "_prefab": {
        "__type__": "cc.PrefabInfo",
        "root": { "__id__": 1 },
        "asset": { "__id__": 0 },
        "fileId": generateShortUUID(),
        "targetOverrides": null,
        "nestedPrefabInstanceRoots": null
      },
      "_lpos": {
        "__type__": "cc.Vec3",
        "x": cocosX,
        "y": cocosY,
        "z": 0
      },
      "_lrot": {
        "__type__": "cc.Quat",
        "x": 0,
        "y": 0,
        "z": 0,
        "w": 1
      },
      "_lscale": {
        "__type__": "cc.Vec3",
        "x": 1,
        "y": 1,
        "z": 1
      },
      "_layer": 33554432
    });

    // Child UITransform
    nodes.push({
      "__type__": "cc.UITransform",
      "_name": "",
      "_objFlags": 0,
      "node": { "__id__": nodeIndex },
      "_enabled": true,
      "__prefab__": {
        "__type__": "cc.CompPrefabInfo",
        "fileId": generateShortUUID()
      },
      "_contentSize": {
        "__type__": "cc.Size",
        "width": piece.width,
        "height": piece.height
      },
      "_anchorPoint": {
        "__type__": "cc.Vec2",
        "x": 0.5,
        "y": 0.5
      }
    });

    // Child Sprite referencing piece spriteFrame UUID
    nodes.push({
      "__type__": "cc.Sprite",
      "_name": "",
      "_objFlags": 0,
      "node": { "__id__": nodeIndex },
      "_enabled": true,
      "__prefab__": {
        "__type__": "cc.CompPrefabInfo",
        "fileId": generateShortUUID()
      },
      "_customMaterial": null,
      "_srcBlendFactor": 2,
      "_dstBlendFactor": 4,
      "_color": {
        "__type__": "cc.Color",
        "r": 255,
        "g": 255,
        "b": 255,
        "a": 255
      },
      "_spriteFrame": {
        "__uuid__": piece.spriteFrameUuid || `${piece.textureUuid}@f9941`,
        "__expectedType__": "cc.SpriteFrame"
      },
      "_type": 0,
      "_sizeMode": 1,
      "_fillType": 0,
      "_fillCenter": {
        "__type__": "cc.Vec2",
        "x": 0,
        "y": 0
      },
      "_fillStart": 0,
      "_fillRange": 0,
      "_isTrimmedMode": true,
      "_useGrayscale": false
    });

    // Add child reference to root node (__id__: 1)
    nodes[1]._children.push({ "__id__": nodeIndex });

    currentId += 3;
  });

  return nodes;
}

/**
 * Generate Cocos Creator 2.x Prefab JSON structure.
 */
export function generateCocos2xPrefab(
  pieces: CutPieceResult[],
  options: PrefabExportOptions
) {
  ensurePieceUuids(pieces, options.cocosVersion);

  const nodes: any[] = [];

  // Root Node
  nodes.push({
    "__type__": "cc.Node",
    "_name": options.rootNodeName || "PrefabRoot",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_level": 1,
    "_components": [],
    "_prefab": {
      "__type__": "cc.PrefabInfo",
      "root": { "__id__": 0 },
      "asset": { "__id__": 0 },
      "fileId": generateShortUUID(),
      "sync": false
    },
    "_opacity": 255,
    "_color": {
      "__type__": "cc.Color",
      "r": 255,
      "g": 255,
      "b": 255,
      "a": 255
    },
    "_contentSize": {
      "__type__": "cc.Size",
      "width": options.canvasWidth,
      "height": options.canvasHeight
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_position": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
      "z": 0
    },
    "_scale": {
      "__type__": "cc.Vec3",
      "x": 1,
      "y": 1,
      "z": 1
    },
    "_rotationX": 0,
    "_rotationY": 0,
    "_skewX": 0,
    "_skewY": 0
  });

  let currentId = 1;

  pieces.forEach((piece) => {
    const nodeIndex = currentId;
    const spriteIndex = currentId + 1;

    const cocosX = piece.x + piece.width / 2 - options.canvasWidth / 2;
    const cocosY = options.canvasHeight / 2 - (piece.y + piece.height / 2);

    nodes.push({
      "__type__": "cc.Node",
      "_name": piece.name,
      "_objFlags": 0,
      "_parent": { "__id__": 0 },
      "_children": [],
      "_active": true,
      "_level": 2,
      "_components": [
        { "__id__": spriteIndex }
      ],
      "_prefab": {
        "__type__": "cc.PrefabInfo",
        "root": { "__id__": 0 },
        "asset": { "__id__": 0 },
        "fileId": generateShortUUID(),
        "sync": false
      },
      "_opacity": 255,
      "_color": {
        "__type__": "cc.Color",
        "r": 255,
        "g": 255,
        "b": 255,
        "a": 255
      },
      "_contentSize": {
        "__type__": "cc.Size",
        "width": piece.width,
        "height": piece.height
      },
      "_anchorPoint": {
        "__type__": "cc.Vec2",
        "x": 0.5,
        "y": 0.5
      },
      "_position": {
        "__type__": "cc.Vec3",
        "x": cocosX,
        "y": cocosY,
        "z": 0
      },
      "_scale": {
        "__type__": "cc.Vec3",
        "x": 1,
        "y": 1,
        "z": 1
      }
    });

    nodes.push({
      "__type__": "cc.Sprite",
      "_name": "",
      "_objFlags": 0,
      "node": { "__id__": nodeIndex },
      "_enabled": true,
      "_materials": [],
      "_srcBlendFactor": 770,
      "_dstBlendFactor": 771,
      "_spriteFrame": {
        "__uuid__": piece.spriteFrameUuid || piece.textureUuid
      },
      "_type": 0,
      "_sizeMode": 1,
      "_fillType": 0,
      "_fillCenter": {
        "__type__": "cc.Vec2",
        "x": 0,
        "y": 0
      },
      "_fillStart": 0,
      "_fillRange": 0,
      "_isTrimmedMode": true,
      "_state": 0
    });

    nodes[0]._children.push({ "__id__": nodeIndex });

    currentId += 2;
  });

  return nodes;
}

/**
 * Generate Cocos Creator .meta sidecar file for a texture PNG (Compatible with Cocos Creator 3.8.8 & 3.x & 2.x).
 */
export function generateTextureMeta(
  piece: CutPieceResult,
  cocosVersion: '3.8.8' | '3.x' | '2.x' = '3.8.8'
): { metaContent: string; uuid: string } {
  const texUuid = piece.textureUuid || generateUUID();

  if (cocosVersion === '2.x') {
    const sfUuid = piece.spriteFrameUuid || generateUUID();
    const metaObj = {
      "ver": "2.3.6",
      "uuid": texUuid,
      "importer": "texture",
      "type": "sprite",
      "subMetas": {
        [piece.name]: {
          "ver": "1.0.4",
          "uuid": sfUuid,
          "importer": "sprite-frame",
          "name": piece.name,
          "rawTextureUuid": texUuid,
          "size": [piece.width, piece.height],
          "type": "sprite",
          "userData": {
            "trimType": "auto",
            "trimThreshold": 1,
            "rotated": false,
            "offsetX": 0,
            "offsetY": 0,
            "trimX": 0,
            "trimY": 0,
            "width": piece.width,
            "height": piece.height,
            "rawWidth": piece.width,
            "rawHeight": piece.height,
            "borderTop": 0,
            "borderBottom": 0,
            "borderLeft": 0,
            "borderRight": 0
          }
        }
      }
    };
    return { metaContent: JSON.stringify(metaObj, null, 2), uuid: texUuid };
  }

  // Cocos 3.x / 3.8.8
  const sfUuid = piece.spriteFrameUuid || `${texUuid}@f9941`;
  const metaObj = {
    "ver": "1.0.22",
    "importer": "image",
    "type": "sprite",
    "uuid": texUuid,
    "files": [
      ".png"
    ],
    "subMetas": {
      "6c48a": {
        "ver": "1.0.4",
        "importer": "texture",
        "name": piece.name,
        "uuid": `${texUuid}@6c48a`,
        "rawTextureUuid": texUuid,
        "size": [piece.width, piece.height],
        "type": "texture",
        "userData": {}
      },
      "f9941": {
        "ver": "1.0.4",
        "importer": "sprite-frame",
        "name": piece.name,
        "uuid": sfUuid,
        "rawTextureUuid": texUuid,
        "size": [piece.width, piece.height],
        "type": "sprite",
        "userData": {
          "trimType": "auto",
          "trimThreshold": 1,
          "rotated": false,
          "offsetX": 0,
          "offsetY": 0,
          "trimX": 0,
          "trimY": 0,
          "width": piece.width,
          "height": piece.height,
          "rawWidth": piece.width,
          "rawHeight": piece.height,
          "borderTop": 0,
          "borderBottom": 0,
          "borderLeft": 0,
          "borderRight": 0,
          "packable": true,
          "pixelsToUnit": 100,
          "pivot": {
            "x": 0.5,
            "y": 0.5
          },
          "meshType": 0
        }
      }
    }
  };
  return { metaContent: JSON.stringify(metaObj, null, 2), uuid: texUuid };
}

/**
 * Generate Cocos Creator .meta sidecar file for a .prefab JSON file.
 */
export function generatePrefabMeta(
  cocosVersion: '3.8.8' | '3.x' | '2.x' = '3.8.8'
): { metaContent: string; uuid: string } {
  const uuid = generateUUID();
  const metaObj = cocosVersion === '2.x' ? {
    "ver": "1.2.0",
    "uuid": uuid,
    "importer": "prefab",
    "type": "prefab",
    "subMetas": {}
  } : {
    "ver": "1.2.0",
    "importer": "prefab",
    "type": "cc.Prefab",
    "uuid": uuid,
    "files": [
      ".json"
    ],
    "subMetas": {}
  };
  return { metaContent: JSON.stringify(metaObj, null, 2), uuid };
}

/**
 * Generate Cocos Creator .meta sidecar file for layout.json catalog file.
 */
export function generateJsonMeta(
  cocosVersion: '3.8.8' | '3.x' | '2.x' = '3.8.8'
): { metaContent: string; uuid: string } {
  const uuid = generateUUID();
  const metaObj = cocosVersion === '2.x' ? {
    "ver": "2.3.6",
    "uuid": uuid,
    "importer": "json",
    "type": "json",
    "subMetas": {}
  } : {
    "ver": "1.0.1",
    "importer": "json",
    "type": "json",
    "uuid": uuid,
    "files": [
      ".json"
    ],
    "subMetas": {}
  };
  return { metaContent: JSON.stringify(metaObj, null, 2), uuid };
}

/**
 * Generate layout.json catalog with absolute coordinates and shape metadata.
 */
export function generateLayoutCatalog(
  pieces: CutPieceResult[],
  options: PrefabExportOptions
) {
  return {
    version: "1.0.0",
    rootNodeName: options.rootNodeName,
    cocosVersion: options.cocosVersion,
    canvasSize: {
      width: options.canvasWidth,
      height: options.canvasHeight
    },
    totalPieces: pieces.length,
    pieces: pieces.map((p) => ({
      id: p.id,
      name: p.name,
      fileName: `${p.name}.png`,
      shapeType: p.shapeType,
      bounds: {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height
      },
      centerOffset: {
        x: p.x + p.width / 2 - options.canvasWidth / 2,
        y: options.canvasHeight / 2 - (p.y + p.height / 2)
      },
      anchor: { x: 0.5, y: 0.5 }
    }))
  };
}

/**
 * Generate a layered Photoshop PSD binary (.psd ArrayBuffer) from cut piece canvases.
 */
export function generateCutPsdBinary(
  pieces: CutPieceResult[],
  canvasWidth: number,
  canvasHeight: number
): ArrayBuffer {
  const psdStructure: any = {
    width: canvasWidth,
    height: canvasHeight,
    children: pieces.map((piece) => ({
      name: piece.name,
      canvas: piece.canvas,
      left: piece.x,
      top: piece.y,
    })),
  };

  return writePsd(psdStructure);
}

/**
 * Generate Cocos Creator .meta sidecar file for a .psd Photoshop file.
 */
export function generatePsdMeta(
  cocosVersion: '3.8.8' | '3.x' | '2.x' = '3.8.8'
): { metaContent: string; uuid: string } {
  const uuid = generateUUID();
  const metaObj = cocosVersion === '2.x' ? {
    "ver": "2.3.6",
    "uuid": uuid,
    "importer": "raw",
    "type": "raw",
    "subMetas": {}
  } : {
    "ver": "1.0.1",
    "importer": "raw",
    "type": "raw",
    "uuid": uuid,
    "files": [
      ".psd"
    ],
    "subMetas": {}
  };
  return { metaContent: JSON.stringify(metaObj, null, 2), uuid };
}

