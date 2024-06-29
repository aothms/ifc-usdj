addEventListener("DOMContentLoaded", () => {

let controls, renderer, scene, camera;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    camera.up.set(0, 0, 1);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    document.body.appendChild(renderer.domElement);
    
    return scene;
}

function createMeshFromJson(node, root) {
    let points = new Float32Array(node.children.find(a => a.points).points.flat());
    let normals = new Float32Array(node.children.find(a => a.normals).normals.flat());
    let indices = new Uint16Array(node.children.find(a => a.faceVertexIndices).faceVertexIndices);    
    
    let group = new THREE.Group();
    let subsets = node.children.filter(a => a.type === 'GeomSubset');
    if (subsets.length === 0) {
        subsets = [node];
    }

    subsets.forEach((subset) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        if (subset.type === 'GeomSubset') {
            let faceSubset = subset.children.find(i => i.indices).indices;
            let indexSubset = new Uint16Array(faceSubset.length * 3);
            let j = 0;
            for (let i = 0; i < faceSubset.length; ++i) {
                for (let k = 0; k < 3; k++) {
                    indexSubset[j++] = indices[3*faceSubset[i]+k];
                }
            }
            geometry.setIndex(new THREE.BufferAttribute(indexSubset, 1));
        } else {
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        }

        let reference = subset.children.find(i => i['material:binding'])['material:binding'].ref;
        let referenceFragments = reference.substring(2, reference.length-1).split('/');
        let currentIndex = root;
        while (referenceFragments.length) {
            currentIndex = currentIndex.children.find(i => i.name === referenceFragments[0]);
            referenceFragments.shift();
        }
        let color = currentIndex
            .children.find(i => i.type === 'Shader')
            .children.find(i => i['inputs:diffuseColor'])['inputs:diffuseColor'];
        const material = new THREE.MeshBasicMaterial();
        material.color = new THREE.Color(...color);
        group.add(new THREE.Mesh(geometry, material));
    });

    return group;
}

function traverseJson(node, parent, root) {
    let elem;
    if (node.type === 'Xform') {
        elem = new THREE.Group();
    } else if (node.type === 'Mesh') {
        elem = createMeshFromJson(node, root);
    } else {
        return;
    }
    parent.add(elem);
    elem.matrixAutoUpdate = false;

    let matrixNode = node.children ? node.children.find(a => a['xformOp:transform']) : null;
    if (matrixNode) {
        let matrix = new THREE.Matrix4();
        matrix.set(...matrixNode['xformOp:transform'].flat());
        matrix.transpose();
        elem.matrix = matrix;
    }

    (node.children || []).forEach(child => traverseJson(child, elem, root));
}

fetch("fzk.usdj")
    .then(response => response.json())
    .then(jsonData => {
        traverseJson(jsonData.children[2], init(), jsonData);
        animate();
    });

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

});