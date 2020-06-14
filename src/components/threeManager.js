import * as THREE from 'three';

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

export const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
export const scene = new THREE.Scene();
export const gl = new THREE.WebGLRenderer( { antialias: true } );
export const collisionObjects = [];
export const events = new THREE.EventDispatcher();
export const init = ()=>{

    // scene.background = new THREE.Color( 0x505050 );

    const ambient = new THREE.AmbientLight();
    ambient.intensity = 0.25;
    scene.add( ambient );

    const point = new THREE.PointLight();
    point.position.set( 10, 10, 10 );
    scene.add( point );

    gl.setPixelRatio( window.devicePixelRatio );
    gl.setSize( window.innerWidth, window.innerHeight );
    gl.outputEncoding = THREE.sRGBEncoding;
    gl.xr.enabled = true;
    gl.toneMapping = THREE.Uncharted2ToneMapping
    gl.setClearColor(new THREE.Color('#020207'))
	gl.xr.setReferenceSpaceType( 'local' );


    document.body.appendChild( gl.domElement );
    document.body.appendChild( VRButton.createButton( gl ) );


    spawnPlane(scene, {geometry:[500, 500, 32], rotation:[Math.PI/2, 0, 0], })

    spawnBox(scene, {geometry:[10,10,10], position:[0, 1, -10]})

    window.addEventListener( 'resize', onWindowResize, false );

    gl.setAnimationLoop( updater );
}

let oldTime = 0;
const updater = time =>{
    render();

    const delta = (time-oldTime)/1000;
    oldTime = time;
    events.dispatchEvent({ type: 'tick', delta });

}
const render = ()=>{
    gl.render( scene, camera );
}
const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    gl.setSize( window.innerWidth, window.innerHeight );
}
const spawnPlane = (target, _props)=>{
    const props = Object.assign({
        geometry:[20, 20, 32],
        material:{color:0xffff00, side: THREE.DoubleSide},
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        collisionObject:true,
    }, (_props || {}))
    const geometry = new THREE.PlaneGeometry( ...props.geometry );
    const material = new THREE.MeshBasicMaterial( props.material);
    const plane = new THREE.Mesh( geometry, material );
    plane.position.copy(new THREE.Vector3(...props.position));
    plane.rotation.setFromVector3(new THREE.Vector3(...props.rotation));
    if(props.collisionObject) collisionObjects.push(plane);
    target.add( plane );
}

export const spawnBox = (target, _props)=>{
    if(!target) target = scene;
    const props = Object.assign({
        geometry:[5, 5, 5],
        material:{color:0xff0000, side: THREE.DoubleSide},
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        collisionObject:true,
    }, (_props || {}))
    const geometry = new THREE.BoxBufferGeometry( ...props.geometry );
    const material = new THREE.MeshBasicMaterial( props.material);
    const box = new THREE.Mesh( geometry, material );
    box.position.copy(new THREE.Vector3(...props.position));
    box.rotation.setFromVector3(new THREE.Vector3(...props.rotation));
    if(props.collisionObject) collisionObjects.push(box);
    target.add( box );
    return box;
}
