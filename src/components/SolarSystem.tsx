import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Planet } from '../types/Planet';
import { planetData } from '../data/planetData';

interface SolarSystemProps {
  planets: Planet[];
  isAnimating: boolean;
  onPlanetHover: (planet: Planet | null, event?: MouseEvent) => void;
}

export const SolarSystem: React.FC<SolarSystemProps> = ({ 
  planets, 
  isAnimating, 
  onPlanetHover 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const animationIdRef = useRef<number>();
  const raycasterRef = useRef<THREE.Raycaster>();
  const mouseRef = useRef<THREE.Vector2>();
  const [hoveredPlanet, setHoveredPlanet] = useState<Planet | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader>();

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.set(0, 80, 120);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    // Texture loader
    textureLoaderRef.current = new THREE.TextureLoader();

    // Raycaster for mouse interactions
    raycasterRef.current = new THREE.Raycaster();
    mouseRef.current = new THREE.Vector2();

    mountRef.current.appendChild(renderer.domElement);

    // Create starfield
    createStarfield(scene);

    // Create sun
    createSun(scene);

    // Create planets and orbit lines
    planets.forEach((planet) => {
      createPlanet(scene, planet);
      createOrbitLine(scene, planet);
    });

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 3, 300);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 300;
    scene.add(sunLight);

    // Additional directional light for better planet visibility
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Mouse move handler
    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current || !raycasterRef.current || !cameraRef.current) return;

      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const planetMeshes = planets
        .filter(p => p.mesh)
        .map(p => p.mesh!);
      
      const intersects = raycasterRef.current.intersectObjects(planetMeshes);
      
      if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object as THREE.Mesh;
        const planet = planets.find(p => p.mesh === intersectedMesh);
        if (planet && planet !== hoveredPlanet) {
          setHoveredPlanet(planet);
          onPlanetHover(planet, event);
        }
      } else if (hoveredPlanet) {
        setHoveredPlanet(null);
        onPlanetHover(null);
      }
    };

    // Window resize handler
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (isAnimating) {
        planets.forEach((planet) => {
          if (planet.mesh) {
            // Update orbital position
            planet.angle += planet.currentSpeed;
            planet.mesh.position.x = Math.cos(planet.angle) * planet.distance;
            planet.mesh.position.z = Math.sin(planet.angle) * planet.distance;
            
            // Rotate planet on its axis (different speeds for variety)
            planet.mesh.rotation.y += getPlanetRotationSpeed(planet.name);
          }
        });

        // Rotate the sun
        const sun = scene.getObjectByName('sun');
        if (sun) {
          sun.rotation.y += 0.005;
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, [planets, isAnimating, hoveredPlanet, onPlanetHover]);

  const getPlanetRotationSpeed = (planetName: string): number => {
    const rotationSpeeds: { [key: string]: number } = {
      'Mercury': 0.02,
      'Venus': -0.015, // Venus rotates backwards
      'Earth': 0.02,
      'Mars': 0.018,
      'Jupiter': 0.04, // Jupiter rotates very fast
      'Saturn': 0.035,
      'Uranus': 0.025,
      'Neptune': 0.022
    };
    return rotationSpeeds[planetName] || 0.02;
  };

  const createStarfield = (scene: THREE.Scene) => {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 2,
      sizeAttenuation: false
    });
    
    const starVertices = [];
    for (let i = 0; i < 15000; i++) {
      const x = (Math.random() - 0.5) * 3000;
      const y = (Math.random() - 0.5) * 3000;
      const z = (Math.random() - 0.5) * 3000;
      starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
  };

  const createSun = (scene: THREE.Scene) => {
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    
    // Create sun texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    
    // Create radial gradient for sun
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#ffff00');
    gradient.addColorStop(0.3, '#ffaa00');
    gradient.addColorStop(0.6, '#ff6600');
    gradient.addColorStop(1, '#ff3300');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    // Add some texture noise
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 3;
      context.fillStyle = `rgba(255, 255, 0, ${Math.random() * 0.3})`;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }
    
    const sunTexture = new THREE.CanvasTexture(canvas);
    
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      map: sunTexture,
      emissive: new THREE.Color(0xffaa00),
      emissiveIntensity: 0.4
    });
    
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.name = 'sun';
    scene.add(sun);
  };

  const createPlanet = (scene: THREE.Scene, planet: Planet) => {
    const geometry = new THREE.SphereGeometry(planet.size * 1.5, 32, 32); // Increased size for better visibility
    
    // Create planet texture using canvas
    const texture = createPlanetTexture(planet);
    
    const material = new THREE.MeshLambertMaterial({ 
      map: texture,
      transparent: false
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.x = planet.distance;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add a subtle glow effect for better visibility
    const glowGeometry = new THREE.SphereGeometry(planet.size * 1.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: planet.color,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glow);
    
    planet.mesh = mesh;
    scene.add(mesh);
  };

  const createPlanetTexture = (planet: Planet): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    
    // Base color
    context.fillStyle = planet.color;
    context.fillRect(0, 0, 256, 256);
    
    // Add planet-specific features
    switch (planet.name) {
      case 'Mercury':
        // Add craters
        for (let i = 0; i < 50; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const radius = Math.random() * 8 + 2;
          context.fillStyle = `rgba(100, 100, 100, ${Math.random() * 0.5 + 0.3})`;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        break;
        
      case 'Venus':
        // Add atmospheric swirls
        context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        context.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          context.beginPath();
          context.moveTo(0, i * 25);
          context.quadraticCurveTo(128, i * 25 + 10, 256, i * 25);
          context.stroke();
        }
        break;
        
      case 'Earth':
        // Add continents (simplified)
        context.fillStyle = '#228B22';
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const width = Math.random() * 40 + 20;
          const height = Math.random() * 30 + 15;
          context.fillRect(x, y, width, height);
        }
        // Add clouds
        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const radius = Math.random() * 15 + 5;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        break;
        
      case 'Mars':
        // Add polar ice caps and surface features
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.beginPath();
        context.arc(128, 20, 25, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(128, 236, 20, 0, Math.PI * 2);
        context.fill();
        break;
        
      case 'Jupiter':
        // Add bands
        context.strokeStyle = 'rgba(139, 69, 19, 0.5)';
        context.lineWidth = 8;
        for (let i = 0; i < 8; i++) {
          context.beginPath();
          context.moveTo(0, i * 32);
          context.lineTo(256, i * 32);
          context.stroke();
        }
        // Add Great Red Spot
        context.fillStyle = 'rgba(255, 0, 0, 0.6)';
        context.beginPath();
        context.ellipse(180, 140, 25, 15, 0, 0, Math.PI * 2);
        context.fill();
        break;
        
      case 'Saturn':
        // Add bands (similar to Jupiter but lighter)
        context.strokeStyle = 'rgba(218, 165, 32, 0.4)';
        context.lineWidth = 6;
        for (let i = 0; i < 10; i++) {
          context.beginPath();
          context.moveTo(0, i * 25);
          context.lineTo(256, i * 25);
          context.stroke();
        }
        break;
        
      case 'Uranus':
        // Add subtle atmospheric features
        context.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 15; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const radius = Math.random() * 10 + 5;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        break;
        
      case 'Neptune':
        // Add storm features
        context.fillStyle = 'rgba(0, 0, 139, 0.4)';
        context.beginPath();
        context.ellipse(150, 100, 20, 12, 0, 0, Math.PI * 2);
        context.fill();
        break;
    }
    
    // Add some general surface variation
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const radius = Math.random() * 3 + 1;
      const opacity = Math.random() * 0.2 + 0.1;
      context.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  };

  const createOrbitLine = (scene: THREE.Scene, planet: Planet) => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * planet.distance,
        0,
        Math.sin(angle) * planet.distance
      ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x555555, 
      transparent: true, 
      opacity: 0.3 
    });
    const orbitLine = new THREE.Line(geometry, material);
    
    planet.orbitLine = orbitLine;
    scene.add(orbitLine);
  };

  return <div ref={mountRef} className="w-full h-full" />;
};