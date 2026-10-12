import * as THREE from './vendor/three/three.module.min.js';

export const RIBBON_SETTINGS = Object.freeze({
  width: .07,
  twist: 1.5,
  surface: 'ribs',
  color: '#b17a5e',
});

function ribbonCurves() {
  const curve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  return [
    curve([
      [-.25,.345,-.04],[-.41,.44,.02],[-.63,.335,.075],[-.65,.14,.015],
      [-.46,.015,-.09],[-.265,-.105,-.01],[-.29,-.32,.1],[-.505,-.42,.055],[-.695,-.30,-.04]
    ]),
    curve([
      [.115,-.425,-.06],[.102,-.16,-.04],[.098,.15,.025],[.13,.415,.02],
      [.335,.445,.015],[.535,.30,-.05],[.46,.115,-.015],[.225,.035,.06],
      [.125,-.025,.145],[.39,-.045,.10],[.59,-.205,.04],[.455,-.40,-.015],[.14,-.425,.01]
    ])
  ];
}

function ribbonGeometry(curve,index) {
  const steps=400, across=RIBBON_SETTINGS.surface==='ribs'?72:16;
  const positions=[],uvs=[],triangles=[];
  const thick=.0055;
  for(let side=0;side<2;side++) {
    for(let i=0;i<=steps;i++) {
      const t=i/steps;
      const p=curve.getPointAt(t);
      const tangent=curve.getTangentAt(t).normalize();
      const phase=index===0?.2:1.9;
      const twist=(.20+Math.sin(t*Math.PI*2+phase)*1.05+Math.sin(t*Math.PI*4-.35)*.18)*RIBBON_SETTINGS.twist;
      const acrossVector=new THREE.Vector3(-tangent.y,tangent.x,0).normalize().applyAxisAngle(tangent,twist);
      const normal=new THREE.Vector3().crossVectors(tangent,acrossVector).normalize();
      const endEase=Math.min(1,t*18,(1-t)*18);
      const width=RIBBON_SETTINGS.width*(.92+.08*Math.sin(t*Math.PI))*(.94+.06*endEase);
      for(let j=0;j<=across;j++) {
        const u=j/across;
        const camber=.0038*(1-Math.pow(u*2-1,2));
        const rib=RIBBON_SETTINGS.surface==='ribs'?.0018*Math.cos(u*Math.PI*18):0;
        const h=(side===0?1:-1)*(thick/2+rib)+camber;
        const point=p.clone().addScaledVector(acrossVector,(u-.5)*width).addScaledVector(normal,h);
        positions.push(...point.toArray());uvs.push(u,t*5);
      }
    }
  }
  const stride=across+1,faceSize=(steps+1)*stride;
  for(let side=0;side<2;side++)for(let i=0;i<steps;i++)for(let j=0;j<across;j++) {
    const a=side*faceSize+i*stride+j,b=a+1,c=a+stride,d=c+1;
    if(side===0)triangles.push(a,b,c,b,d,c);else triangles.push(a,c,b,b,c,d);
  }
  for(let i=0;i<steps;i++)for(const j of [0,across]) {
    const a=i*stride+j,b=(i+1)*stride+j,c=a+faceSize,d=b+faceSize;
    triangles.push(a,c,b,b,c,d);
  }
  for(const i of [0,steps])for(let j=0;j<across;j++) {
    const a=i*stride+j,b=a+1,c=a+faceSize,d=b+faceSize;
    triangles.push(a,b,c,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(triangles);geometry.computeVertexNormals();
  return geometry;
}


export function createRibbonMonogram(material) {
  const monogram = new THREE.Group();
  let wireLength = 0;
  for (const [index, curve] of ribbonCurves().entries()) {
    const geometry = ribbonGeometry(curve, index);
    const length = curve.getLength();
    const uv = geometry.getAttribute('uv');
    const distances = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) distances[i] = wireLength + uv.getY(i) / 5 * length;
    geometry.setAttribute('wireDistance', new THREE.Float32BufferAttribute(distances, 1));
    monogram.add(new THREE.Mesh(geometry, material));
    wireLength += length;
  }
  monogram.userData.wireLength = wireLength;
  const center = new THREE.Box3().setFromObject(monogram).getCenter(new THREE.Vector3());
  for (const mesh of monogram.children) mesh.position.sub(center);
  return monogram;
}
