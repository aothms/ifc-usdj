addEventListener("DOMContentLoaded", () => {

let controls, renderer, scene, camera;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    camera.up.set(0, 0, 1);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth - 200, window.innerHeight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    document.body.appendChild(renderer.domElement);
    
    return scene;
}

function createMeshFromJson(node, root) {
    let points = new Float32Array(node.attributes.points.flat());
    let normals = new Float32Array(node.attributes.normals.flat());
    let indices = new Uint16Array(node.attributes.faceVertexIndices);    
    
    let group = new THREE.Group();
    let subsets = node.children ? node.children.filter(a => a.type === 'GeomSubset') : [];
    if (subsets.length === 0) {
        subsets = [node];
    }

    subsets.forEach((subset) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        if (subset.type === 'GeomSubset') {
            let faceSubset = subset.attributes.indices;
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

        let reference = subset.attributes['material:binding'].ref;
        let referenceFragments = reference.substring(2, reference.length-1).split('/');
        let currentIndex = root;
        while (referenceFragments.length) {
            currentIndex = currentIndex.children.find(i => i.name === referenceFragments[0]);
            referenceFragments.shift();
        }
        let color = currentIndex
            .children.find(i => i.type === 'Shader')
            .attributes['inputs:diffuseColor']
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

    let matrixNode = node.attributes && node.attributes['xformOp:transform'] ? node.attributes['xformOp:transform'].flat() : null;
    if (matrixNode) {
        let matrix = new THREE.Matrix4();
        matrix.set(...matrixNode);
        matrix.transpose();
        elem.matrix = matrix;
    }

    (node.children || []).forEach(child => traverseJson(child, elem, root));
}

const urls = ["fzk.json", "fzk-extra-window.json"];

urls.forEach(u => {
    let d = document.createElement('div');
    d.innerHTML = `<span class='button'>👁</span><span>${u}</span>`
    document.querySelector('#controls').appendChild(
        d
    );
});

Array.from(document.querySelectorAll('span.button')).forEach(b => {
    b.onclick = (e) => {
        b.parentNode.classList.toggle('disabled');
        while(scene.children.length > 0){
            scene.remove(scene.children[0]); 
        }
        renderer.clear();
        composeAndRender();
    }
});




function compose(datas) {
    // Composition, the naive way:
    //  - flatten tree to list of <path, object> pairs
    //  - group objects with among layers with the same path
    //  - recompose into hierarchical structure
    
    function collectPaths(node) {
        const paths = new Map();
        function traverse(node, path) {
            if (node.name) {
                path = path.concat(node.name || '');
                paths.set(path.join('/'), node);
            }
            (node.children || []).forEach(child => traverse(child, path || []));
        }
        traverse(node);
        return paths;
    }

    const maps = datas.map(collectPaths);

    const combined = new Map();
    for (const map of maps) {
        for (const [key, v] of map) {
            if (key.endsWith('product_463575f4_f696_42de_bde9_918a6fe7650a_body')) {
                debugger;
            }
            let {attributes, children, ...value} = v;
            if (combined.has(key)) {
                const orig = combined.get(key);
                combined.set(key, {...orig, ...value, ...{attributes: {...orig.attributes, ...attributes}}});
            } else {
                combined.set(key, {...value, ...{attributes: attributes}});
            }
        }
    }

    function insertPath(obj, path, value) {
        const parts = path.split('/');
        let current = obj;

        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                const cs = current.children = current.children || [];
                cs.push(value);
            } else {
                current = current.children?.find(child => child.name === part);
            }
        });
    }

    const root = { };

    Array.from(combined.entries()).sort((p, q) => p[0].length - q[0].length).forEach(([path, value]) => {
        insertPath(root, path, value);
    });

    return root;
}

let datas = null;

function composeAndRender() {
    let enabled = Array.from(document.querySelectorAll('span.button')).map(e => !e.parentNode.classList.contains('disabled'));
    let data = compose(datas.filter((_, i) => enabled[i]));
    traverseJson(data.children.find(i => i.type === "Xform"), scene || init(), data);
    animate();
}

Promise.all(urls.map(u => fetch(u).then(response => response.json()))).then((ds) => {
    datas = ds;
    composeAndRender();
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

});