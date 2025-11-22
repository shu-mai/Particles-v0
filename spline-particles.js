// three.js particle system

console.log('🚀 (restored) Initializing particle system...');

document.addEventListener('DOMContentLoaded', async () => {
	try {
		const THREE = await import('https://cdn.skypack.dev/three@0.128.0');
		const canvas = document.getElementById('canvas3d');
		if (!canvas) {
			console.error('❌ Canvas #canvas3d not found');
			return;
		}
		initializeParticleSystem(THREE, canvas);
	} catch (e) {
		console.error('❌ Failed to load Three.js or init:', e);
	}
});

function initializeParticleSystem(THREE, canvas) {
	// Scene
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
	camera.position.z = 220;

	// Renderer
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor(0x000000, 0);
	
	// Responsive sizing (will be updated after material is created)
	let material = null;
	function updateSize() {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		renderer.setSize(width, height);
		camera.aspect = width / height;  // Maintains aspect ratio
		camera.updateProjectionMatrix();
		// Update viewport height uniform for responsive particle sizing
		if (material && material.uniforms && material.uniforms.viewportHeight) {
			material.uniforms.viewportHeight.value = Math.max(height || 600, 600); // Ensure minimum of 600
		}
	}
	
	// Update on resize
	window.addEventListener('resize', updateSize);

	// Config & state
	const baseConfig = {
		count: 5000,
		size: 1.5,
		speed: 5,
		lifetime: 10,
		colorA: 0xffffff,
		opacity: 1.0,
		gravity: 0.08,
		sphereRadius: 80,
		colliderRadius: 120,
		noise: { scale: 40, variation: 25, seed: 100, smallScale: 0.4, largeScale: 0.15, smallStrength: 0.5, largeStrength: 0.3 }
	};
	const particleStates = {
		unfocused: { ...baseConfig },
		focused: { ...baseConfig, speed: 2, gravity: 0.05, sphereRadius: 60, colliderRadius: 90, noise: { scale: 20, variation: 8, seed: 100, smallScale: 0.2, largeScale: 0.1, smallStrength: 0.3, largeStrength: 0.2 } },
		thinking: { ...baseConfig, speed: 2, opacity: 0.8, gravity: 0.0, sphereRadius: 80, noise: { scale: 25, variation: 15, seed: 100, smallScale: 0.4, largeScale: 0.3, smallStrength: 0.5, largeStrength: 0.3 } },
		typing: { ...baseConfig, speed: 3, gravity: 0.05, sphereRadius: 80, noise: { scale: 25, variation: 10, seed: 100, smallScale: 0.3, largeScale: 0.2, smallStrength: 0.3, largeStrength: 0.2 } },
		tracing: { ...baseConfig, count: 3000, size: 1.5, speed: 3, lifetime: 12, colorA: 0xff6b35, gravity: 0.0, sphereRadius: 80, colliderRadius: 120, noise: { scale: 15, variation: 5, seed: 100, smallScale: 0.2, largeScale: 0.1, smallStrength: 0.2, largeStrength: 0.1 } }
	};
	let currentState = 'unfocused';
	let particleConfig = { ...particleStates[currentState] };
	let targetConfig = { ...particleConfig };
	let isUserTyping = false;
	let characterCount = 0;

	// Geometry & buffers
	const maxParticles = 12000;
	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(maxParticles * 3);
	const colors = new Float32Array(maxParticles * 3);
	const alphas = new Float32Array(maxParticles);
	const sizes = new Float32Array(maxParticles);
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
	geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

		material = new THREE.ShaderMaterial({
		uniforms: { 
			pointTexture: { value: createParticleTexture(THREE) },
			viewportHeight: { value: Math.max(canvas.clientHeight || 600, 600) } // Ensure minimum of 600
		},
		vertexShader: `
			uniform float viewportHeight;
			attribute float alpha;
			attribute float size;
			varying float vAlpha;
			void main() {
				vAlpha = alpha;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				// Responsive particle sizing - scales down more aggressively on larger screens
				// Uses a smaller reference height (800px) so particles are smaller on big monitors
				// Original was 300, so we normalize: 300 * (800 / viewportHeight)
				// This makes particles scale down more on larger screens
				float referenceHeight = 800.0;
				float baseScale = 300.0 * (referenceHeight / max(viewportHeight, 600.0));
				gl_PointSize = size * (baseScale / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform sampler2D pointTexture;
			varying float vAlpha;
			void main() {
				vec4 texColor = texture2D(pointTexture, gl_PointCoord);
				gl_FragColor = vec4(1.0, 1.0, 1.0, texColor.a * vAlpha);
			}
		`,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true
	});
	// Update viewport height uniform now that material is created
	updateSize();
	const particleSystem = new THREE.Points(geometry, material);
	scene.add(particleSystem);

	// Particles store
	const particles = [];
	function createParticle(aroundPoint = null) {
		let x, y, z;
		let initialTarget = null;
		let initialPointIndex = undefined;
		
		if (aroundPoint && isTransitioning && previousTracePoints.length > 0) {
			// Create particle near existing trace point with random offset (transition)
			const offset = 5 + Math.random() * 10; // 5-15 unit radius around point
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			x = aroundPoint.x + offset * Math.sin(phi) * Math.cos(theta);
			y = aroundPoint.y + offset * Math.sin(phi) * Math.sin(theta);
			z = aroundPoint.z + offset * Math.cos(phi);
			// Assign to follow the point it was created around
			const pointIdx = previousTracePoints.findIndex(pt => 
				Math.abs(pt.x - aroundPoint.x) < 0.1 && Math.abs(pt.y - aroundPoint.y) < 0.1
			);
			if (pointIdx >= 0) {
				initialTarget = { ...previousTracePoints[pointIdx] };
				initialPointIndex = pointIdx;
			}
		} else if (aroundPoint && isTracing && tracePoints.length > 0) {
			// Create particle near trace point when typing during tracing
			const offset = 3 + Math.random() * 8; // 3-11 unit radius around trace point
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			x = aroundPoint.x + offset * Math.sin(phi) * Math.cos(theta);
			y = aroundPoint.y + offset * Math.sin(phi) * Math.sin(theta);
			z = aroundPoint.z + offset * Math.cos(phi);
			// Assign to follow the trace point it was created around
			const pointIdx = tracePoints.findIndex(pt => 
				Math.abs(pt.x - aroundPoint.x) < 0.1 && Math.abs(pt.y - aroundPoint.y) < 0.1
			);
			if (pointIdx >= 0) {
				initialTarget = { ...tracePoints[pointIdx] };
				initialPointIndex = pointIdx;
			}
		} else {
			// Normal particle creation
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const radius = particleConfig.sphereRadius + (Math.random() - 0.5) * 15;
			x = radius * Math.sin(phi) * Math.cos(theta);
			y = radius * Math.sin(phi) * Math.sin(theta);
			z = radius * Math.cos(phi);
			// Assign a trace target immediately if tracing is active
			if (isTracing && tracePoints.length > 0) {
				const idx = Math.floor(Math.random() * tracePoints.length);
				initialTarget = { ...tracePoints[idx] };
				initialPointIndex = idx;
			}
		}
		
		return {
			position: new THREE.Vector3(x, y, z),
			velocity: new THREE.Vector3((Math.random()-0.5)*particleConfig.speed*0.1,(Math.random()-0.5)*particleConfig.speed*0.1,(Math.random()-0.5)*particleConfig.speed*0.1),
			age: 0,
			lifetime: particleConfig.lifetime * (0.8 + Math.random() * 0.4),
			size: particleConfig.size * (0.8 + Math.random() * 0.4),
			speedMultiplier: 0.5 + Math.random() * 1.0,
			color: new THREE.Color(particleConfig.colorA),
			active: true,
			traceTarget: initialTarget,
			tracePointIndex: initialPointIndex,
			noiseOffset: { x: Math.random() * 1000, y: Math.random() * 1000, z: Math.random() * 1000 }
		};
	}
	function emitParticles(dt) {
		// During transition, emit more particles rapidly around existing trace points
		if (isTransitioning && previousTracePoints.length > 0) {
			const transitionDuration = 1.0; // 1 second transition
			const elapsed = (performance.now() - transitionStartTime) / 1000;
			if (elapsed < transitionDuration) {
				// Rapid burst: emit 10-20 particles per frame during transition
				const burstCount = Math.floor(15 * dt * 60); // Scale with frame rate
				for (let i = 0; i < burstCount; i++) {
					if (particles.length < maxParticles) {
						const randomPoint = previousTracePoints[Math.floor(Math.random() * previousTracePoints.length)];
						particles.push(createParticle(randomPoint));
					} else {
						const idx = particles.findIndex(p => !p.active);
						if (idx !== -1) {
							const randomPoint = previousTracePoints[Math.floor(Math.random() * previousTracePoints.length)];
							particles[idx] = createParticle(randomPoint);
						}
					}
				}
				return; // Skip normal emission during transition
			} else {
				// Transition complete, switch to new trace
				console.log('✅ Transition complete, switching to new trace');
				isTransitioning = false;
				previousTracePoints = [];
				assignTraceTargets(); // Assign all particles to new trace points
				setParticleState('tracing'); // Ensure state is set
			}
		}
		
		// Normal particle emission (with boost when user is typing)
		let emitRate = particleConfig.count / particleConfig.lifetime;
		
		// Scale emission rate based on character count (linear scaling)
		// Base rate when characterCount = 0, increases with each character
		if (isUserTyping && currentState !== 'thinking') {
			// Character count multiplier: 1.0 (base) + 0.05 per character, capped at 3.0x
			const charMultiplier = Math.min(1.0 + characterCount * 0.08, 5.0);
			emitRate *= charMultiplier;
		}
		
		const n = Math.floor(emitRate * dt);
		
		// When typing during tracing, create particles around trace points
		if (isUserTyping && isTracing && tracePoints.length > 0) {
			// Create extra particles from trace points
			const extraParticles = Math.floor(n * 0.6); // 60% of emission from trace points
			for (let i = 0; i < extraParticles; i++) {
				if (particles.length < maxParticles) {
					const randomPoint = tracePoints[Math.floor(Math.random() * tracePoints.length)];
					particles.push(createParticle(randomPoint));
				} else {
					const idx = particles.findIndex(p => !p.active);
					if (idx !== -1) {
						const randomPoint = tracePoints[Math.floor(Math.random() * tracePoints.length)];
						particles[idx] = createParticle(randomPoint);
					}
				}
			}
			// Remaining particles created normally
			for (let i = 0; i < n - extraParticles; i++) {
				if (particles.length < maxParticles) particles.push(createParticle());
				else {
					const idx = particles.findIndex(p => !p.active);
					if (idx !== -1) particles[idx] = createParticle();
				}
			}
		} else {
			// Normal emission
			for (let i = 0; i < n; i++) {
				if (particles.length < maxParticles) particles.push(createParticle());
				else {
					const idx = particles.findIndex(p => !p.active);
					if (idx !== -1) particles[idx] = createParticle();
				}
			}
		}
	}

	// Noise helpers
	function noise3D(x, y, z, scale, seed) {
		const s = scale || 1;
		const seedOffset = seed * 0.01;
		return Math.sin((x + seedOffset) * s) * Math.cos(y * s) * Math.sin(z * s);
	}
	function curlNoise(x, y, z, scale, seed = 100) {
		const eps = 0.1;
		const n1 = noise3D(x + eps, y, z, scale, seed);
		const n2 = noise3D(x - eps, y, z, scale, seed);
		const n3 = noise3D(x, y + eps, z, scale, seed);
		const n4 = noise3D(x, y - eps, z, scale, seed);
		const n5 = noise3D(x, y, z + eps, scale, seed);
		const n6 = noise3D(x, y, z - eps, scale, seed);
		return { x: ((n4 - n3) - (n6 - n5)) * 0.5, y: ((n6 - n5) - (n2 - n1)) * 0.5, z: ((n2 - n1) - (n4 - n3)) * 0.5 };
	}

	// Tracing
	let isTracing = false;
	let tracePoints = [];
	let tracingTimeout = null;
	let isTransitioning = false;
	let previousTracePoints = [];
	let transitionStartTime = 0;

	function assignTraceTargets() {
		if (tracePoints.length === 0) return;
		let pointIndex = 0;
		for (let i = 0; i < particles.length; i++) {
			if (!particles[i] || !particles[i].active) continue;
			particles[i].traceTarget = { ...tracePoints[pointIndex] };
			particles[i].tracePointIndex = pointIndex; // Track which point this particle is on
			pointIndex = (pointIndex + 1) % tracePoints.length; // cycle so all get targets
		}
	}

	function updateParticles(dt) {
		const pos = geometry.attributes.position.array;
		const al = geometry.attributes.alpha.array;
		const sz = geometry.attributes.size.array;
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			if (!p.active) continue;
			p.age += dt;
			if (p.age > p.lifetime) { p.active = false; al[i] = 0; continue; }

			const t = p.age * 0.1;
			const small = curlNoise(p.position.x*0.025 + t*0.8 + p.noiseOffset.x*0.001, p.position.y*0.025 + t*0.8 + p.noiseOffset.y*0.001, p.position.z*0.025 + t*0.8 + p.noiseOffset.z*0.001, particleConfig.noise.smallScale, particleConfig.noise.seed);
			const large = curlNoise(p.position.x*0.012 + t*0.4 + p.noiseOffset.x*0.0005, p.position.y*0.012 + t*0.4 + p.noiseOffset.y*0.0005, p.position.z*0.012 + t*0.4 + p.noiseOffset.z*0.0005, particleConfig.noise.largeScale, particleConfig.noise.seed + 100);
			const nx = small.x * particleConfig.noise.smallStrength + large.x * particleConfig.noise.largeStrength;
			const ny = small.y * particleConfig.noise.smallStrength + large.y * particleConfig.noise.largeStrength;
			const nz = small.z * particleConfig.noise.smallStrength + large.z * particleConfig.noise.largeStrength;
			const varStrength = particleConfig.noise.variation * 0.12;
			p.velocity.x += (nx * varStrength + (Math.random() - 0.5) * 0.3) * p.speedMultiplier;
			p.velocity.y += (ny * varStrength + (Math.random() - 0.5) * 0.3) * p.speedMultiplier;
			p.velocity.z += (nz * varStrength + (Math.random() - 0.5) * 0.3) * p.speedMultiplier;
			p.velocity.y -= particleConfig.gravity * 0.05;

			if (isTracing && p.traceTarget) {
				// During transition, particles may be following previous trace points
				// They'll naturally migrate to new targets when assignTraceTargets is called
				const dx = p.traceTarget.x - p.position.x;
				const dy = p.traceTarget.y - p.position.y;
				const dz = p.traceTarget.z - p.position.z;
				const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
				
				// Determine which trace point array to use
				const activeTracePoints = isTransitioning && previousTracePoints.length > 0 && 
					(performance.now() - transitionStartTime) / 1000 < 1.0 
					? previousTracePoints : tracePoints;
				
				// When particle reaches target, move to next point in sequence
				if (dist < 0.5) {
					// Use stored point index for efficiency
					const currentIdx = p.tracePointIndex !== undefined ? p.tracePointIndex : 
						activeTracePoints.findIndex(pt => 
							Math.abs(pt.x - p.traceTarget.x) < 0.1 && 
							Math.abs(pt.y - p.traceTarget.y) < 0.1
						);
					if (currentIdx >= 0 && currentIdx < activeTracePoints.length - 1) {
						// Move to next point in sequence
						p.tracePointIndex = currentIdx + 1;
						p.traceTarget = { ...activeTracePoints[p.tracePointIndex] };
					} else if (currentIdx === activeTracePoints.length - 1) {
						// Loop back to start for continuous tracing
						p.tracePointIndex = 0;
						p.traceTarget = { ...activeTracePoints[0] };
					}
				}
				
				if (dist > 1) {
					// Pull toward target
					const pull = 0.6; // back to original value
					p.velocity.x = dx * pull;
					p.velocity.y = dy * pull;
					p.velocity.z = dz * pull;
				} else {
					// When close, slow down
					p.velocity.multiplyScalar(0.5);
				}
				// Normal velocity damping
				p.velocity.multiplyScalar(0.95); // back to original
				// Normal movement speed
				p.position.x += p.velocity.x * dt * 3; // back to original
				p.position.y += p.velocity.y * dt * 3;
				p.position.z += p.velocity.z * dt * 3;
			} else {
				const distC = p.position.length();
				const targetR = particleConfig.sphereRadius + Math.sin(p.age * 1.5) * 8;
				const pullSurf = (distC - targetR) * 0.05;
				const nrm = p.position.clone().normalize();
				p.velocity.x -= nrm.x * pullSurf;
				p.velocity.y -= nrm.y * pullSurf;
				p.velocity.z -= nrm.z * pullSurf;
				if (distC > particleConfig.colliderRadius) {
					const push = (distC - particleConfig.colliderRadius) * 0.3;
					p.velocity.x -= nrm.x * push;
					p.velocity.y -= nrm.y * push;
					p.velocity.z -= nrm.z * push;
				}
				p.velocity.multiplyScalar(0.98);
				p.position.x += p.velocity.x * dt * p.speedMultiplier;
				p.position.y += p.velocity.y * dt * p.speedMultiplier;
				p.position.z += p.velocity.z * dt * p.speedMultiplier;
			}

			const lifeRatio = p.age / p.lifetime;
			const alpha = 1.0 - lifeRatio;
			pos[i*3] = p.position.x; pos[i*3+1] = p.position.y; pos[i*3+2] = p.position.z;
			al[i] = alpha * particleConfig.opacity;
			// Base size multiplier for tracing particles (no glow when typing)
			let baseSizeMultiplier = isTracing && p.traceTarget ? 1.5 : 1.0;
			sz[i] = p.size * baseSizeMultiplier;
		}
		geometry.attributes.position.needsUpdate = true;
		geometry.attributes.alpha.needsUpdate = true;
		geometry.attributes.size.needsUpdate = true;
	}

	function createParticleTexture(THREE) {
		const c = document.createElement('canvas');
		c.width = 64; c.height = 64;
		const ctx = c.getContext('2d');
		const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
		const tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
	}

	function setParticleState(stateName) {
		if (!particleStates[stateName]) stateName = 'unfocused';
		currentState = stateName;
		targetConfig = { ...particleStates[stateName] };
		console.log(`🎨 Transitioning to ${stateName}`);
	}

	function lerpConfig(dt) {
		const s = 0.08;
		let sphereMul = 1.0, sizeMul = 1.0, opacityMul = 1.0;
		if (currentState === 'typing' || currentState === 'thinking') {
			const t = performance.now() * 0.005;
			const pulse = Math.sin(t) * 0.15 + 1.05;
			sphereMul = pulse; sizeMul = pulse * 0.4 + 0.75;
		}
		// Steady glow effect when user is actively typing (but not during tracing - tracing has its own glow)
		if (isUserTyping && currentState !== 'thinking' && currentState !== 'tracing') {
			sizeMul = Math.max(sizeMul, 1.3); // Steady 30% size increase, no pulsing
			opacityMul = 1.1; // Slightly brighter
		}
		for (const k of ['count','size','speed','lifetime','opacity','gravity','sphereRadius','colliderRadius']) {
			let target;
			if (k === 'sphereRadius' || k === 'colliderRadius') {
				target = targetConfig[k] * sphereMul;
			} else if (k === 'size') {
				target = targetConfig[k] * sizeMul;
			} else if (k === 'opacity') {
				target = targetConfig[k] * opacityMul;
			} else {
				target = targetConfig[k];
			}
			particleConfig[k] += (target - particleConfig[k]) * s;
		}
		for (const k of ['scale','variation','smallScale','largeScale','smallStrength','largeStrength']) {
			particleConfig.noise[k] += (targetConfig.noise[k] - particleConfig.noise[k]) * s;
		}
		particleConfig.noise.seed = targetConfig.noise.seed;
	}

	let last = performance.now();
	(function animate() {
		requestAnimationFrame(animate);
		const now = performance.now();
		const dt = (now - last) / 1000; last = now;
		lerpConfig(dt);
		emitParticles(dt);
		updateParticles(dt);
		renderer.render(scene, camera);
	})();

	// ================================
	// IMAGE PROCESSING (Advanced Edges)
	// ================================
	async function processImageForTracing(imageData, opts = {}) {
		return new Promise((resolve) => {
			try {
				if (!imageData) { console.error('No image data'); resolve([]); return; }
				const img = new Image();
				if (opts.imageMime === 'image/svg+xml') {
					// For SVG, decode base64 first, then use URL encoding for data URL
					try {
						const svgString = atob(imageData);
						img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
					} catch (e) {
						console.error('SVG decode error:', e);
						// Fallback to base64
						img.src = `data:image/svg+xml;base64,${imageData}`;
					}
				} else {
					img.src = `data:image/png;base64,${imageData}`;
				}
				img.onload = () => {
					try {
						// Verify image loaded correctly
						if (!img.width || !img.height || img.width === 0 || img.height === 0) {
							console.error('Invalid image dimensions:', img.width, img.height);
							resolve([]);
							return;
						}
						
						console.log(`📐 Image dimensions: ${img.width}x${img.height}`);
						
						// Normalize to consistent size - always use 1024x1024 for processing
						// This ensures consistent sizing regardless of what the API returns
						const targetSize = 1024;
						
						const canvas = document.createElement('canvas');
						const ctx = canvas.getContext('2d');
						canvas.width = targetSize;
						canvas.height = targetSize;
						
						// Calculate scale to fit image into target size while maintaining aspect ratio
						const scale = Math.min(targetSize / img.width, targetSize / img.height);
						const scaledWidth = img.width * scale;
						const scaledHeight = img.height * scale;
						
						// Center the image on the canvas
						const offsetX = (targetSize - scaledWidth) / 2;
						const offsetY = (targetSize - scaledHeight) / 2;
						
						// Fill with black background first
						ctx.fillStyle = '#000000';
						ctx.fillRect(0, 0, targetSize, targetSize);
						
						// Draw the image centered
						ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
						
						console.log(`📐 Canvas dimensions: ${canvas.width}x${canvas.height}, image scaled to: ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}, offset: ${offsetX.toFixed(0)},${offsetY.toFixed(0)}`);
						
						// Verify we got the full image data
						const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
						if (!imgData || imgData.width !== canvas.width || imgData.height !== canvas.height) {
							console.error('Image data mismatch:', {
								expected: `${canvas.width}x${canvas.height}`,
								got: `${imgData?.width || 0}x${imgData?.height || 0}`
							});
							resolve([]);
							return;
						}
						
						console.log(`✅ Image data extracted: ${imgData.width}x${imgData.height}`);
						
						// Quick check: verify image has content in all quadrants (detect if cut off)
						const hasContent = checkImageCompleteness(imgData);
						if (!hasContent) {
							console.warn('⚠️ Image may be incomplete - missing content in some quadrants');
						}
						
						// Extract centerline instead of edges to avoid double-tracing thick lines
						const centerline = extractCenterline(imgData);
						let points = centerline.map(e => ({ x: (e.x / canvas.width - 0.5) * 220, y: -(e.y / canvas.height - 0.5) * 220, z: 0 }));
						// Less aggressive filtering - only remove truly isolated points
						// Reduced minNeighbors from 3 to 1, increased radius from 4 to 6
						points = filterOutliers(points, 6, 1, 10000);
						resolve(points);
					} catch (err) { console.error('Process error:', err); resolve([]); }
				};
				img.onerror = () => { console.error('Image load error'); resolve([]); };
			} catch (e) { console.error('Error:', e); resolve([]); }
		});
	}

	// Check if image appears complete by verifying content in all quadrants
	function checkImageCompleteness(imageData) {
		const width = imageData.width, height = imageData.height;
		const d = imageData.data;
		const threshold = 128; // White pixel threshold
		
		// Check each quadrant for white pixels
		const quadrants = [
			{ x: 0, y: 0, w: Math.floor(width/2), h: Math.floor(height/2) }, // Top-left
			{ x: Math.floor(width/2), y: 0, w: width, h: Math.floor(height/2) }, // Top-right
			{ x: 0, y: Math.floor(height/2), w: Math.floor(width/2), h: height }, // Bottom-left
			{ x: Math.floor(width/2), y: Math.floor(height/2), w: width, h: height } // Bottom-right
		];
		
		let quadrantsWithContent = 0;
		for (const quad of quadrants) {
			let hasWhite = false;
			// Sample some pixels in this quadrant
			for (let y = quad.y; y < quad.h && y < height; y += Math.max(1, Math.floor(height/50))) {
				for (let x = quad.x; x < quad.w && x < width; x += Math.max(1, Math.floor(width/50))) {
					const idx = (y * width + x) * 4;
					const brightness = (d[idx] + d[idx+1] + d[idx+2]) / 3;
					if (brightness > threshold) {
						hasWhite = true;
						break;
					}
				}
				if (hasWhite) break;
			}
			if (hasWhite) quadrantsWithContent++;
		}
		
		// If less than 2 quadrants have content, image might be cut off
		if (quadrantsWithContent < 2) {
			console.warn(`⚠️ Only ${quadrantsWithContent} quadrant(s) have content - image may be incomplete`);
			return false;
		}
		return true;
	}

	function extractCenterline(imageData) {
		const width = imageData.width, height = imageData.height;
		const d = imageData.data;
		
		// Verify image data is valid
		if (!width || !height || d.length !== width * height * 4) {
			console.error('Invalid image data:', { width, height, dataLength: d.length, expected: width * height * 4 });
			return [];
		}
		
		// Create binary mask (white = 1, black = 0)
		const binary = new Uint8Array(width * height);
		for (let i = 0, p = 0; i < d.length; i += 4, p++) {
			// Check if pixel is white (threshold > 128)
			binary[p] = (d[i] + d[i+1] + d[i+2]) / 3 > 128 ? 1 : 0;
		}
		
		// Simple distance transform - find distance to nearest black pixel
		const distance = new Float32Array(width * height);
		const maxDist = Math.max(width, height);
		
		// Initialize: white pixels get max distance, black get 0
		for (let i = 0; i < width * height; i++) {
			distance[i] = binary[i] === 1 ? maxDist : 0;
		}
		
		// Forward pass (top-left to bottom-right)
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = y * width + x;
				if (binary[idx] === 1) {
					let minDist = distance[idx];
					// Check top and left neighbors
					if (y > 0) minDist = Math.min(minDist, distance[(y-1)*width + x] + 1);
					if (x > 0) minDist = Math.min(minDist, distance[y*width + (x-1)] + 1);
					if (y > 0 && x > 0) minDist = Math.min(minDist, distance[(y-1)*width + (x-1)] + Math.SQRT2);
					if (y > 0 && x < width-1) minDist = Math.min(minDist, distance[(y-1)*width + (x+1)] + Math.SQRT2);
					distance[idx] = minDist;
				}
			}
		}
		
		// Backward pass (bottom-right to top-left)
		for (let y = height - 1; y >= 0; y--) {
			for (let x = width - 1; x >= 0; x--) {
				const idx = y * width + x;
				if (binary[idx] === 1) {
					let minDist = distance[idx];
					// Check bottom and right neighbors
					if (y < height - 1) minDist = Math.min(minDist, distance[(y+1)*width + x] + 1);
					if (x < width - 1) minDist = Math.min(minDist, distance[y*width + (x+1)] + 1);
					if (y < height - 1 && x < width - 1) minDist = Math.min(minDist, distance[(y+1)*width + (x+1)] + Math.SQRT2);
					if (y < height - 1 && x > 0) minDist = Math.min(minDist, distance[(y+1)*width + (x-1)] + Math.SQRT2);
					distance[idx] = minDist;
				}
			}
		}
		
		// Extract centerline: find local maxima (pixels that are centers of thick regions)
		const centerline = [];
		const marginX = Math.max(10, Math.floor(width * 0.05));
		const marginY = Math.max(10, Math.floor(height * 0.05));
		
		for (let y = marginY; y < height - marginY; y++) {
			for (let x = marginX; x < width - marginX; x++) {
				const idx = y * width + x;
				if (binary[idx] === 1) {
					// Include thin lines (distance >= 0.5) and thick lines (distance > 1)
					// For thin lines (1 pixel), distance will be ~0.5-1, so include them
					if (distance[idx] >= 0.5) {
						// For thick lines, find local maxima (centers)
						// For thin lines, include all pixels
						if (distance[idx] > 1) {
							// Thick line: check if this is a local maximum
							let isMax = true;
							const currentDist = distance[idx];
							
							// Check 8-connected neighbors
							for (let dy = -1; dy <= 1; dy++) {
								for (let dx = -1; dx <= 1; dx++) {
									if (dx === 0 && dy === 0) continue;
									const nx = x + dx, ny = y + dy;
									if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
										const nIdx = ny * width + nx;
										if (binary[nIdx] === 1 && distance[nIdx] > currentDist) {
											isMax = false;
											break;
										}
									}
								}
								if (!isMax) break;
							}
							
							if (isMax) {
								centerline.push({ x, y, strength: distance[idx] });
							}
						} else {
							// Thin line: include all pixels to avoid gaps
							centerline.push({ x, y, strength: distance[idx] });
						}
					}
				}
			}
		}
		
		// If no centerline found, fall back to edge detection
		if (centerline.length === 0) {
			return detectEdgesAdvanced(imageData, { low: 5, high: 20, blurSigma: 0.5 });
		}
		
		return centerline;
	}

	function detectEdgesAdvanced(imageData, { low = 20, high = 60, blurSigma = 1.2 } = {}) {
		const width = imageData.width, height = imageData.height;
		const gray = new Float32Array(width * height);
		const d = imageData.data;
		for (let i = 0, p = 0; i < d.length; i += 4, p++) gray[p] = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114);
		const blurred = gaussianBlur(gray, width, height, blurSigma);
		const { mag, dir } = sobel(blurred, width, height);
		const nms = nonMaxSuppression(mag, dir, width, height);
		const strong = hysteresis(nms, width, height, low, high);
		// Reduced cell size from 3 to 1 for denser point sampling (no gaps)
		const cell = 1; const edges = [];
		
		// Border margin to ignore (5% of dimension or at least 10px)
		const marginX = Math.max(10, Math.floor(width * 0.05));
		const marginY = Math.max(10, Math.floor(height * 0.05));
		
		for (let y = marginY; y < height - marginY; y += cell) {
			for (let x = marginX; x < width - marginX; x += cell) {
				if (strong[y*width + x]) {
					edges.push({ x: x, y: y, strength: nms[y*width + x] });
				}
			}
		}
		edges.sort((a,b)=>b.strength-a.strength);
		// Return all edges - no limit for maximum coverage
		return edges;
	}

	function gaussianBlur(src, width, height, sigma) {
		if (sigma <= 0) return src;
		const radius = Math.max(1, Math.floor(sigma * 2.5));
		const size = radius * 2 + 1; const kernel = new Float32Array(size);
		const s2 = 2 * sigma * sigma; let sum = 0;
		for (let i = -radius; i <= radius; i++) { const v = Math.exp(-(i*i)/s2); kernel[i+radius] = v; sum += v; }
		for (let i = 0; i < size; i++) kernel[i] /= sum;
		const temp = new Float32Array(width * height); const out = new Float32Array(width * height);
		for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) { let acc = 0; for (let k=-radius;k<=radius;k++){ const xx=Math.min(width-1, Math.max(0,x+k)); acc += src[y*width+xx]*kernel[k+radius]; } temp[y*width+x]=acc; } }
		for (let x = 0; x < width; x++) { for (let y = 0; y < height; y++) { let acc = 0; for (let k=-radius;k<=radius;k++){ const yy=Math.min(height-1, Math.max(0,y+k)); acc += temp[yy*width+x]*kernel[k+radius]; } out[y*width+x]=acc; } }
		return out;
	}
	function sobel(src, width, height) {
		const gxK = [-1,0,1,-2,0,2,-1,0,1]; const gyK = [-1,-2,-1,0,0,0,1,2,1];
		const mag = new Float32Array(width*height); const dir = new Float32Array(width*height);
		for (let y=1;y<height-1;y++){
			for(let x=1;x<width-1;x++){
				let gx=0,gy=0,idx=0; for(let ky=-1;ky<=1;ky++){ for(let kx=-1;kx<=1;kx++){ const v=src[(y+ky)*width+(x+kx)]; gx+=v*gxK[idx]; gy+=v*gyK[idx]; idx++; }}
				const m=Math.hypot(gx,gy); mag[y*width+x]=m; dir[y*width+x]=Math.atan2(gy,gx);
			}
		}
		return { mag, dir };
	}
	function nonMaxSuppression(mag, dir, width, height) {
		const out = new Float32Array(width*height);
		for (let y=1;y<height-1;y++){
			for(let x=1;x<width-1;x++){
				const a=dir[y*width+x]; const angle=((a*180/Math.PI)+180)%180; const m=mag[y*width+x];
				let m1=0,m2=0;
				if((angle>=0&&angle<22.5)||(angle>=157.5)){ m1=mag[y*width+(x-1)]; m2=mag[y*width+(x+1)]; }
				else if(angle>=22.5&&angle<67.5){ m1=mag[(y-1)*width+(x+1)]; m2=mag[(y+1)*width+(x-1)]; }
				else if(angle>=67.5&&angle<112.5){ m1=mag[(y-1)*width+x]; m2=mag[(y+1)*width+x]; }
				else { m1=mag[(y-1)*width+(x-1)]; m2=mag[(y+1)*width+(x+1)]; }
				out[y*width+x] = (m>=m1 && m>=m2) ? m : 0;
			}
		}
		return out;
	}
	function hysteresis(nms, width, height, low, high) {
		const strong = new Uint8Array(width*height); const stack=[];
		for (let i=0;i<nms.length;i++){ if(nms[i]>=high){ strong[i]=1; stack.push(i);} }
		const neighbors=[-1,0,1];
		while(stack.length){ const idx=stack.pop(); const y=Math.floor(idx/width); const x=idx%width;
			for(const dy of neighbors){ for(const dx of neighbors){ if(dx===0&&dy===0) continue; const nx=x+dx, ny=y+dy; if(nx<=0||nx>=width-1||ny<=0||ny>=height-1) continue; const nIdx=ny*width+nx; if(!strong[nIdx] && nms[nIdx]>=low){ strong[nIdx]=1; stack.push(nIdx);} }} }
		return strong;
	}

	// Remove points with too few neighbors (islands) and cap output count
	// Order points along the path to preserve continuity
	function orderPointsAlongPath(points) {
		if (points.length <= 1) return points;
		
		// Find starting point (furthest from center or top-left)
		let startIdx = 0;
		let maxDist = 0;
		for (let i = 0; i < points.length; i++) {
			const dist = Math.sqrt(points[i].x * points[i].x + points[i].y * points[i].y);
			if (dist > maxDist) {
				maxDist = dist;
				startIdx = i;
			}
		}
		
		const ordered = [points[startIdx]];
		const remaining = points.map((p, i) => i).filter(i => i !== startIdx);
		let current = points[startIdx];
		
		// Greedy path: always pick nearest unvisited point
		while (remaining.length > 0) {
			let nearestIdx = 0;
			let nearestDist = Infinity;
			
			for (let i = 0; i < remaining.length; i++) {
				const idx = remaining[i];
				const dx = points[idx].x - current.x;
				const dy = points[idx].y - current.y;
				const dist = Math.sqrt(dx*dx + dy*dy);
				
				if (dist < nearestDist) {
					nearestDist = dist;
					nearestIdx = i;
				}
			}
			
			const nextIdx = remaining[nearestIdx];
			ordered.push(points[nextIdx]);
			current = points[nextIdx];
			remaining.splice(nearestIdx, 1);
		}
		
		return ordered;
	}
	
	// Distance-based downsampling that preserves path continuity
	function downsamplePoints(points, maxPoints) {
		if (points.length <= maxPoints) return points;
		
		// First order points along the path
		const ordered = orderPointsAlongPath(points);
		
		// Calculate total path length
		let totalLength = 0;
		for (let i = 1; i < ordered.length; i++) {
			const dx = ordered[i].x - ordered[i-1].x;
			const dy = ordered[i].y - ordered[i-1].y;
			totalLength += Math.sqrt(dx*dx + dy*dy);
		}
		
		// Target spacing between points
		const targetSpacing = totalLength / maxPoints;
		const sampled = [ordered[0]]; // Always keep first point
		let accumulatedDist = 0;
		
		for (let i = 1; i < ordered.length; i++) {
			const dx = ordered[i].x - ordered[i-1].x;
			const dy = ordered[i].y - ordered[i-1].y;
			const segmentDist = Math.sqrt(dx*dx + dy*dy);
			accumulatedDist += segmentDist;
			
			// If we've accumulated enough distance, add this point
			if (accumulatedDist >= targetSpacing) {
				sampled.push(ordered[i]);
				accumulatedDist = 0;
			}
		}
		
		// Always keep last point
		if (sampled[sampled.length - 1] !== ordered[ordered.length - 1]) {
			sampled.push(ordered[ordered.length - 1]);
		}
		
		return sampled;
	}

	function filterOutliers(points, neighborRadius = 8, minNeighbors = 3, maxPoints = 1800) {
		if (points.length === 0) return points;
		const r2 = neighborRadius * neighborRadius;
		// Spatial hash
		const cell = neighborRadius;
		const grid = new Map();
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const gx = Math.floor(p.x / cell);
			const gy = Math.floor(p.y / cell);
			const key = `${gx},${gy}`;
			let arr = grid.get(key); if (!arr) { arr = []; grid.set(key, arr); }
			arr.push(i);
		}
		const kept = [];
		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const gx = Math.floor(p.x / cell);
			const gy = Math.floor(p.y / cell);
			let neighbors = 0;
			for (let yy = -1; yy <= 1; yy++) {
				for (let xx = -1; xx <= 1; xx++) {
					const arr = grid.get(`${gx+xx},${gy+yy}`);
					if (!arr) continue;
					for (const j of arr) {
						if (j === i) continue;
						const q = points[j];
						const dx = q.x - p.x; const dy = q.y - p.y;
						if (dx*dx + dy*dy <= r2) {
							neighbors++;
							if (neighbors >= minNeighbors) break;
						}
					}
					if (neighbors >= minNeighbors) break;
				}
				if (neighbors >= minNeighbors) break;
			}
			if (neighbors >= minNeighbors) kept.push(p);
			if (kept.length >= maxPoints) break;
		}
		return kept;
	}

	// Public API
	async function startTracing(imageData, opts = {}) {
		try {
			console.log('🎨 Starting tracing...');
			const points = await processImageForTracing(imageData, opts);
			if (points.length === 0) { console.warn('No trace points'); return; }
			// Increased max points significantly to prevent gaps
			const maxPoints = 5000;
			let newTracePoints;
			if (points.length > maxPoints) {
				// Use distance-based downsampling that preserves path continuity
				newTracePoints = downsamplePoints(points, maxPoints);
			} else {
				newTracePoints = points;
			}
			
			// If already tracing, start transition effect
			if (isTracing && tracePoints.length > 0) {
				console.log('🔄 Transitioning from existing trace...');
				previousTracePoints = [...tracePoints]; // Store current trace points
				tracePoints = newTracePoints; // Set new trace points
				isTransitioning = true;
				transitionStartTime = performance.now();
				// Keep tracing state active, particles will continue following previous points
				// New particles will be created around previous trace points
			} else {
				// Normal start
				tracePoints = newTracePoints;
				isTracing = true;
				assignTraceTargets();
				setParticleState('tracing');
			}
			
			if (tracingTimeout) clearTimeout(tracingTimeout);
			tracingTimeout = setTimeout(() => { stopTracing(); }, 30000);
			console.log(`🎨 Tracing ${tracePoints.length} points`);
		} catch (err) { console.error('Tracing error:', err); stopTracing(); }
	}
	function stopTracing() {
		console.log('🎨 Stopping tracing');
		isTracing = false;
		isTransitioning = false;
		tracePoints = [];
		previousTracePoints = [];
		for (let i = 0; i < particles.length; i++) if (particles[i]) particles[i].traceTarget = null;
		if (tracingTimeout) { clearTimeout(tracingTimeout); tracingTimeout = null; }
		setParticleState('unfocused');
	}

	function setUserTyping(typing) {
		isUserTyping = typing;
	}

	function setCharacterCount(count) {
		characterCount = Math.max(0, count); // Ensure non-negative
	}

	window.SplineParticles = {
		setState: setParticleState,
		getCurrentState: () => currentState,
		traceImage: startTracing,
		stopTracing: stopTracing,
		isTracing: () => isTracing,
		setUserTyping: setUserTyping,
		setCharacterCount: setCharacterCount,
		test: () => { console.log('Current:', currentState); console.log('Active particles:', particles.filter(p => p.active).length); }
	};

	console.log('✅ Particle system ready');
}