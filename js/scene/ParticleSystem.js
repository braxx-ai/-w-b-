// ==========================================
// SISTEMA DE PARTÍCULAS
// ==========================================

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createExplosion(position, color = CONSTANTS.COLORS.PRIMARY_CYAN) {
        const particleCount = CONSTANTS.PARTICLES.COUNT_EXPLOSION;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(
                CONSTANTS.PARTICLES.SPEED.min + 
                Math.random() * (CONSTANTS.PARTICLES.SPEED.max - CONSTANTS.PARTICLES.SPEED.min)
            );
            velocities.push(velocity);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const colorObj = new THREE.Color(color);
        const material = new THREE.PointsMaterial({
            size: 3,
            color: colorObj,
            opacity: 0.8,
            transparent: true,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        particles.userData.velocities = velocities;
        particles.userData.life = CONSTANTS.PARTICLES.LIFE.max;
        particles.userData.maxLife = CONSTANTS.PARTICLES.LIFE.max;
        particles.userData.gravity = -0.02;

        this.scene.add(particles);
        this.particles.push(particles);

        return particles;
    }

    createDataStream(startPos, endPos) {
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            const t = i / (particleCount * 3);
            const x = startPos.x + (endPos.x - startPos.x) * t;
            const y = startPos.y + (endPos.y - startPos.y) * t;
            const z = startPos.z + (endPos.z - startPos.z) * t;

            positions[i] = x;
            positions[i + 1] = y;
            positions[i + 2] = z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            size: 2,
            color: CONSTANTS.COLORS.PRIMARY_CYAN,
            opacity: 0.6,
            transparent: true,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        particles.userData.velocities = [];
        particles.userData.life = 1000;
        particles.userData.maxLife = 1000;

        for (let i = 0; i < particleCount; i++) {
            const direction = new THREE.Vector3()
                .subVectors(endPos, startPos)
                .normalize();
            particles.userData.velocities.push(
                direction.multiplyScalar(Math.random() * 0.3 + 0.1)
            );
        }

        this.scene.add(particles);
        this.particles.push(particles);

        return particles;
    }

    update() {
        this.particles = this.particles.filter(particle => {
            const positions = particle.geometry.attributes.position.array;
            const velocities = particle.userData.velocities;
            const life = particle.userData.life - 16; // ~60fps

            particle.userData.life = life;

            if (life <= 0) {
                this.scene.remove(particle);
                geometry.dispose();
                particle.material.dispose();
                return false;
            }

            // Actualizar posiciones
            for (let i = 0; i < velocities.length; i++) {
                const v = velocities[i];
                const idx = i * 3;

                positions[idx] += v.x;
                positions[idx + 1] += v.y + (particle.userData.gravity || 0);
                positions[idx + 2] += v.z;

                // Aplicar gravedad leve
                if (particle.userData.gravity !== undefined) {
                    v.y += particle.userData.gravity;
                }
            }

            particle.geometry.attributes.position.needsUpdate = true;

            // Fade out
            const alpha = Math.max(0, life / particle.userData.maxLife);
            particle.material.opacity = alpha;

            return true;
        });
    }

    clear() {
        this.particles.forEach(particle => {
            this.scene.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
        });
        this.particles = [];
    }
}

// Instancia global
const particleSystem = new ParticleSystem(sceneManager.getScene());
