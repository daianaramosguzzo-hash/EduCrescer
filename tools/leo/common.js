import * as THREE from '../../lib/three.module.min.js';
import { FBXLoader } from './FBXLoader.js';
import { mergeVertices } from '../../lib/addons/BufferGeometryUtils.js';
// carrega o FBX e devolve a geometria em metros, pés em y=0, frente +z
export async function loadLeo() {
  const o = await new FBXLoader().loadAsync('leo.fbx');
  let mesh; o.traverse(c => { if (c.isMesh) mesh = c; });
  o.updateMatrixWorld(true);
  let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(0.01, 0.01, 0.01);
  g.computeVertexNormals(); g.computeBoundingBox();
  return g;
}
