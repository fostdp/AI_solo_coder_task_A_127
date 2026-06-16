(function (global) {
    'use strict';

    var Loom3DViewer = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        container: null,
        containerId: null,
        warpGroup: null,
        warpThreads: null,
        warpLineSegments: null,
        warpPositionsAttr: null,
        warpColorsAttr: null,
        warpBaseYs: null,
        warpDisplayCount: 0,
        warpDisplayStep: 1,
        patternGroup: null,
        patternCards: [],
        warpLines: [],
        harnessLines: [],
        fabricMesh: null,
        loomGroup: null,
        animationId: null,
        onTickCallback: null,
        isInitialized: false,
        currentShedState: [],
        targetShedState: [],
        shedAnimProgress: 0,
        patternAnimState: {
            currentPos: 0,
            targetPos: 0,
            progress: 1
        },
        fabricProgress: 0,
        _easeOutCubic: function (t) {
            return 1 - Math.pow(1 - t, 3);
        },
        _lerp: function (a, b, t) {
            return a + (b - a) * t;
        },
        init: function (containerId) {
            if (!containerId) return;
            this.containerId = containerId;
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            var width = this.container.clientWidth || 800;
            var height = this.container.clientHeight || 600;

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x0d1309);
            this.scene.fog = new THREE.Fog(0x0d1309, 20, 60);

            this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
            this.camera.position.set(8, 6, 10);
            this.camera.lookAt(0, 1.5, 0);

            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this.renderer.setSize(width, height);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.container.appendChild(this.renderer.domElement);

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.target.set(0, 1.5, 0);
            this.controls.minDistance = 5;
            this.controls.maxDistance = 30;
            this.controls.maxPolarAngle = Math.PI * 0.48;
            this.controls.update();

            this._setupLights();
            this._setupGround();

            this.isInitialized = true;
            this._bindResize();
            this.animate();
        },
        _setupLights: function () {
            if (!this.scene) return;

            var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            this.scene.add(ambientLight);

            var dirLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
            dirLight.position.set(-8, 12, 6);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 50;
            dirLight.shadow.camera.left = -12;
            dirLight.shadow.camera.right = 12;
            dirLight.shadow.camera.top = 12;
            dirLight.shadow.camera.bottom = -12;
            dirLight.shadow.bias = -0.0005;
            this.scene.add(dirLight);

            var pointLight1 = new THREE.PointLight(0xffcc80, 0.5, 20, 2);
            pointLight1.position.set(4, 5, 4);
            this.scene.add(pointLight1);

            var pointLight2 = new THREE.PointLight(0xffcc80, 0.4, 18, 2);
            pointLight2.position.set(-5, 4, -3);
            this.scene.add(pointLight2);
        },
        _setupGround: function () {
            if (!this.scene) return;

            var groundWidth = 20;
            var groundDepth = 20;
            var groundGeometry = new THREE.PlaneGeometry(groundWidth, groundDepth, 1, 1);

            var groundCanvas = document.createElement('canvas');
            groundCanvas.width = 512;
            groundCanvas.height = 512;
            var gctx = groundCanvas.getContext('2d');
            var gradient = gctx.createLinearGradient(0, 0, 512, 512);
            gradient.addColorStop(0, '#2d2319');
            gradient.addColorStop(0.5, '#3d2e1f');
            gradient.addColorStop(1, '#251c14');
            gctx.fillStyle = gradient;
            gctx.fillRect(0, 0, 512, 512);
            for (var i = 0; i < 40; i++) {
                var yPos = Math.random() * 512;
                gctx.strokeStyle = 'rgba(93, 58, 26, ' + (0.2 + Math.random() * 0.3) + ')';
                gctx.lineWidth = 0.5 + Math.random() * 2;
                gctx.beginPath();
                gctx.moveTo(0, yPos);
                gctx.lineTo(512, yPos + (Math.random() - 0.5) * 30);
                gctx.stroke();
            }
            for (var j = 0; j < 100; j++) {
                var nx = Math.random() * 512;
                var ny = Math.random() * 512;
                gctx.fillStyle = 'rgba(101, 67, 33, ' + (0.1 + Math.random() * 0.25) + ')';
                gctx.beginPath();
                gctx.arc(nx, ny, Math.random() * 3 + 1, 0, Math.PI * 2);
                gctx.fill();
            }
            var groundTexture = new THREE.CanvasTexture(groundCanvas);
            groundTexture.wrapS = THREE.RepeatWrapping;
            groundTexture.wrapT = THREE.RepeatWrapping;
            groundTexture.repeat.set(4, 4);

            var groundMaterial = new THREE.MeshPhongMaterial({
                map: groundTexture,
                color: 0x3d2e1f,
                shininess: 8,
                specular: 0x1a1008
            });

            var ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = 0;
            ground.receiveShadow = true;
            ground.name = 'ground';
            this.scene.add(ground);
        },
        _bindResize: function () {
            var self = this;
            window.addEventListener('resize', function () {
                self._onResize();
            });
        },
        _onResize: function () {
            if (!this.container || !this.camera || !this.renderer) return;
            var width = this.container.clientWidth || 800;
            var height = this.container.clientHeight || 600;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        },
        _createWoodMaterial: function (color, shininess) {
            var woodCanvas = document.createElement('canvas');
            woodCanvas.width = 256;
            woodCanvas.height = 256;
            var wctx = woodCanvas.getContext('2d');
            var baseColor = color || 0x5d3a1a;
            var r = (baseColor >> 16) & 255;
            var g = (baseColor >> 8) & 255;
            var b = baseColor & 255;
            wctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
            wctx.fillRect(0, 0, 256, 256);
            for (var i = 0; i < 60; i++) {
                var lineY = Math.random() * 256;
                var alpha = 0.05 + Math.random() * 0.2;
                var lineR = Math.max(0, r - 20 - Math.random() * 30);
                var lineG = Math.max(0, g - 15 - Math.random() * 25);
                var lineB = Math.max(0, b - 10 - Math.random() * 20);
                wctx.strokeStyle = 'rgba(' + lineR + ',' + lineG + ',' + lineB + ',' + alpha + ')';
                wctx.lineWidth = 0.3 + Math.random() * 1.5;
                wctx.beginPath();
                wctx.moveTo(0, lineY);
                wctx.bezierCurveTo(
                    64, lineY + (Math.random() - 0.5) * 20,
                    128, lineY + (Math.random() - 0.5) * 15,
                    192, lineY + (Math.random() - 0.5) * 25
                );
                wctx.lineTo(256, lineY + (Math.random() - 0.5) * 10);
                wctx.stroke();
            }
            for (var j = 0; j < 30; j++) {
                var knotX = Math.random() * 256;
                var knotY = Math.random() * 256;
                var knotR = 2 + Math.random() * 6;
                var knotGrad = wctx.createRadialGradient(knotX, knotY, 0, knotX, knotY, knotR);
                knotGrad.addColorStop(0, 'rgba(40, 20, 10, 0.4)');
                knotGrad.addColorStop(0.7, 'rgba(70, 40, 20, 0.2)');
                knotGrad.addColorStop(1, 'rgba(93, 58, 26, 0)');
                wctx.fillStyle = knotGrad;
                wctx.beginPath();
                wctx.arc(knotX, knotY, knotR, 0, Math.PI * 2);
                wctx.fill();
            }
            var woodTexture = new THREE.CanvasTexture(woodCanvas);
            woodTexture.wrapS = THREE.RepeatWrapping;
            woodTexture.wrapT = THREE.RepeatWrapping;
            return new THREE.MeshPhongMaterial({
                map: woodTexture,
                color: baseColor,
                shininess: shininess || 10,
                specular: 0x2a1a0a
            });
        },
        buildLoomModel: function () {
            if (!this.isInitialized || !this.scene) return null;

            var woodMat = this._createWoodMaterial(0x5d3a1a, 10);
            var woodMatDark = this._createWoodMaterial(0x4a2d14, 8);
            var woodMatLight = this._createWoodMaterial(0x6b4423, 12);

            this.loomGroup = new THREE.Group();
            this.loomGroup.name = 'loomGroup';

            var baseY = 0.1;
            var baseWidth = 6;
            var baseDepth = 5;
            var baseThickness = 0.2;
            var pillarHeight = 2.5;
            var totalHeight = 4;
            var pillarSize = 0.18;

            var pillarPositions = [
                { x: -baseWidth / 2 + pillarSize / 2, z: -baseDepth / 2 + pillarSize / 2 },
                { x: baseWidth / 2 - pillarSize / 2, z: -baseDepth / 2 + pillarSize / 2 },
                { x: -baseWidth / 2 + pillarSize / 2, z: baseDepth / 2 - pillarSize / 2 },
                { x: baseWidth / 2 - pillarSize / 2, z: baseDepth / 2 - pillarSize / 2 }
            ];

            for (var i = 0; i < pillarPositions.length; i++) {
                var pillar = new THREE.Mesh(
                    new THREE.BoxGeometry(pillarSize, pillarHeight, pillarSize),
                    woodMat
                );
                pillar.position.set(
                    pillarPositions[i].x,
                    baseY + baseThickness + pillarHeight / 2,
                    pillarPositions[i].z
                );
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                this.loomGroup.add(pillar);
            }

            var basePlatform = new THREE.Mesh(
                new THREE.BoxGeometry(baseWidth, baseThickness, baseDepth),
                woodMatDark
            );
            basePlatform.position.set(0, baseY + baseThickness / 2, 0);
            basePlatform.castShadow = true;
            basePlatform.receiveShadow = true;
            this.loomGroup.add(basePlatform);

            var topBeamY = baseY + baseThickness + pillarHeight;
            var topBeam1 = new THREE.Mesh(
                new THREE.BoxGeometry(baseWidth, 0.15, 0.2),
                woodMat
            );
            topBeam1.position.set(0, topBeamY, -baseDepth / 2 + pillarSize / 2 + 0.1);
            topBeam1.castShadow = true;
            topBeam1.receiveShadow = true;
            this.loomGroup.add(topBeam1);

            var topBeam2 = new THREE.Mesh(
                new THREE.BoxGeometry(baseWidth, 0.15, 0.2),
                woodMat
            );
            topBeam2.position.set(0, topBeamY, baseDepth / 2 - pillarSize / 2 - 0.1);
            topBeam2.castShadow = true;
            topBeam2.receiveShadow = true;
            this.loomGroup.add(topBeam2);

            var sideBeamZ1 = -baseDepth / 2 + pillarSize / 2 + 0.1;
            var sideBeamZ2 = baseDepth / 2 - pillarSize / 2 - 0.1;
            for (var sb = 0; sb < 2; sb++) {
                var zPos = sb === 0 ? sideBeamZ1 : sideBeamZ2;
                var midBeam = new THREE.Mesh(
                    new THREE.BoxGeometry(baseWidth, 0.12, 0.15),
                    woodMatLight
                );
                midBeam.position.set(0, baseY + baseThickness + pillarHeight * 0.45, zPos);
                midBeam.castShadow = true;
                midBeam.receiveShadow = true;
                this.loomGroup.add(midBeam);

                var lowerBeam = new THREE.Mesh(
                    new THREE.BoxGeometry(baseWidth, 0.12, 0.15),
                    woodMatLight
                );
                lowerBeam.position.set(0, baseY + baseThickness + pillarHeight * 0.15, zPos);
                lowerBeam.castShadow = true;
                lowerBeam.receiveShadow = true;
                this.loomGroup.add(lowerBeam);
            }

            var warpBeamZ = -baseDepth / 2 + 0.4;
            var warpBeamRadius = 0.22;
            var warpBeam = new THREE.Mesh(
                new THREE.CylinderGeometry(warpBeamRadius, warpBeamRadius, baseWidth - 0.6, 32),
                woodMatDark
            );
            warpBeam.rotation.z = Math.PI / 2;
            warpBeam.position.set(0, baseY + baseThickness + pillarHeight * 0.6, warpBeamZ);
            warpBeam.castShadow = true;
            warpBeam.receiveShadow = true;
            warpBeam.name = 'warpBeam';
            this.loomGroup.add(warpBeam);

            for (var ce = 0; ce < 2; ce++) {
                var endX = ce === 0 ? -(baseWidth / 2 - 0.1) : (baseWidth / 2 - 0.1);
                var endCap = new THREE.Mesh(
                    new THREE.CylinderGeometry(warpBeamRadius + 0.05, warpBeamRadius + 0.05, 0.08, 32),
                    woodMat
                );
                endCap.rotation.z = Math.PI / 2;
                endCap.position.set(endX, warpBeam.position.y, warpBeamZ);
                endCap.castShadow = true;
                this.loomGroup.add(endCap);
            }

            var clothBeamZ = baseDepth / 2 - 0.4;
            var clothBeamRadius = 0.18;
            var clothBeam = new THREE.Mesh(
                new THREE.CylinderGeometry(clothBeamRadius, clothBeamRadius, baseWidth - 0.6, 32),
                woodMatDark
            );
            clothBeam.rotation.z = Math.PI / 2;
            clothBeam.position.set(0, baseY + baseThickness + pillarHeight * 0.5, clothBeamZ);
            clothBeam.castShadow = true;
            clothBeam.receiveShadow = true;
            clothBeam.name = 'clothBeam';
            this.loomGroup.add(clothBeam);

            for (var cb = 0; cb < 2; cb++) {
                var cbEndX = cb === 0 ? -(baseWidth / 2 - 0.1) : (baseWidth / 2 - 0.1);
                var cbEndCap = new THREE.Mesh(
                    new THREE.CylinderGeometry(clothBeamRadius + 0.05, clothBeamRadius + 0.05, 0.08, 32),
                    woodMat
                );
                cbEndCap.rotation.z = Math.PI / 2;
                cbEndCap.position.set(cbEndX, clothBeam.position.y, clothBeamZ);
                cbEndCap.castShadow = true;
                this.loomGroup.add(cbEndCap);
            }

            var flowerTowerHeight = 0.8;
            var flowerTowerWidth = baseWidth * 0.55;
            var flowerTowerDepth = baseDepth * 0.4;
            var flowerTowerY = topBeamY + flowerTowerHeight / 2;

            var ftFrontLeft = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, flowerTowerHeight, 0.12),
                woodMat
            );
            ftFrontLeft.position.set(-flowerTowerWidth / 2, flowerTowerY, -flowerTowerDepth / 2);
            ftFrontLeft.castShadow = true;
            this.loomGroup.add(ftFrontLeft);

            var ftFrontRight = ftFrontLeft.clone();
            ftFrontRight.position.set(flowerTowerWidth / 2, flowerTowerY, -flowerTowerDepth / 2);
            this.loomGroup.add(ftFrontRight);

            var ftBackLeft = ftFrontLeft.clone();
            ftBackLeft.position.set(-flowerTowerWidth / 2, flowerTowerY, flowerTowerDepth / 2);
            this.loomGroup.add(ftBackLeft);

            var ftBackRight = ftFrontLeft.clone();
            ftBackRight.position.set(flowerTowerWidth / 2, flowerTowerY, flowerTowerDepth / 2);
            this.loomGroup.add(ftBackRight);

            var ftTopBeamF = new THREE.Mesh(
                new THREE.BoxGeometry(flowerTowerWidth + 0.12, 0.12, 0.12),
                woodMat
            );
            ftTopBeamF.position.set(0, topBeamY + flowerTowerHeight, -flowerTowerDepth / 2);
            ftTopBeamF.castShadow = true;
            this.loomGroup.add(ftTopBeamF);

            var ftTopBeamB = ftTopBeamF.clone();
            ftTopBeamB.position.set(0, topBeamY + flowerTowerHeight, flowerTowerDepth / 2);
            this.loomGroup.add(ftTopBeamB);

            var ftSideBeamL = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.12, flowerTowerDepth + 0.12),
                woodMat
            );
            ftSideBeamL.position.set(-flowerTowerWidth / 2, topBeamY + flowerTowerHeight, 0);
            ftSideBeamL.castShadow = true;
            this.loomGroup.add(ftSideBeamL);

            var ftSideBeamR = ftSideBeamL.clone();
            ftSideBeamR.position.set(flowerTowerWidth / 2, topBeamY + flowerTowerHeight, 0);
            this.loomGroup.add(ftSideBeamR);

            var ftBottomPlatform = new THREE.Mesh(
                new THREE.BoxGeometry(flowerTowerWidth, 0.06, flowerTowerDepth),
                woodMatLight
            );
            ftBottomPlatform.position.set(0, topBeamY, 0);
            ftBottomPlatform.castShadow = true;
            ftBottomPlatform.receiveShadow = true;
            this.loomGroup.add(ftBottomPlatform);

            var ftTopPlatform = ftBottomPlatform.clone();
            ftTopPlatform.position.set(0, topBeamY + flowerTowerHeight, 0);
            this.loomGroup.add(ftTopPlatform);

            var ftMiddleBeam = new THREE.Mesh(
                new THREE.BoxGeometry(flowerTowerWidth * 0.7, 0.08, 0.1),
                woodMatLight
            );
            ftMiddleBeam.position.set(0, topBeamY + flowerTowerHeight * 0.45, 0);
            ftMiddleBeam.castShadow = true;
            this.loomGroup.add(ftMiddleBeam);

            var ftMiddleBeam2 = ftMiddleBeam.clone();
            ftMiddleBeam2.position.set(0, topBeamY + flowerTowerHeight * 0.75, 0);
            this.loomGroup.add(ftMiddleBeam2);

            var harnessWidth = baseWidth * 0.75;
            var harnessHeight = pillarHeight * 0.35;
            var harnessDepth = 0.15;
            var harnessY = baseY + baseThickness + pillarHeight * 0.4;
            var harnessZ = 0;

            var harnessFrame = new THREE.Group();
            harnessFrame.name = 'harnessFrame';

            var hfTop = new THREE.Mesh(
                new THREE.BoxGeometry(harnessWidth, 0.08, harnessDepth),
                woodMatLight
            );
            hfTop.position.y = harnessHeight / 2;
            hfTop.castShadow = true;
            harnessFrame.add(hfTop);

            var hfBottom = hfTop.clone();
            hfBottom.position.y = -harnessHeight / 2;
            harnessFrame.add(hfBottom);

            var hfLeft = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, harnessHeight, harnessDepth),
                woodMatLight
            );
            hfLeft.position.x = -harnessWidth / 2;
            hfLeft.castShadow = true;
            harnessFrame.add(hfLeft);

            var hfRight = hfLeft.clone();
            hfRight.position.x = harnessWidth / 2;
            harnessFrame.add(hfRight);

            var midBarCount = 4;
            for (var mb = 1; mb < midBarCount; mb++) {
                var midBar = new THREE.Mesh(
                    new THREE.BoxGeometry(harnessWidth - 0.08, 0.04, 0.06),
                    woodMat
                );
                midBar.position.y = -harnessHeight / 2 + (harnessHeight / midBarCount) * mb;
                midBar.castShadow = true;
                harnessFrame.add(midBar);
            }

            harnessFrame.position.set(0, harnessY, harnessZ);
            this.loomGroup.add(harnessFrame);
            this.harnessFrame = harnessFrame;

            var treadleCount = 2;
            var treadleWidth = baseWidth * 0.4;
            var treadleY = baseY + baseThickness + 0.2;
            for (var t = 0; t < treadleCount; t++) {
                var treadle = new THREE.Mesh(
                    new THREE.BoxGeometry(treadleWidth, 0.08, 0.12),
                    woodMat
                );
                treadle.position.set(
                    0,
                    treadleY,
                    baseDepth / 2 - 1.2 + t * 0.35
                );
                treadle.castShadow = true;
                this.loomGroup.add(treadle);
            }

            var sideSupportCount = 3;
            for (var s = 0; s < sideSupportCount; s++) {
                var ssYRatio = 0.2 + s * 0.25;
                var leftSupport = new THREE.Mesh(
                    new THREE.BoxGeometry(0.06, 0.1, baseDepth - 0.8),
                    woodMat
                );
                leftSupport.position.set(
                    -baseWidth / 2 + pillarSize,
                    baseY + baseThickness + pillarHeight * ssYRatio,
                    0
                );
                leftSupport.rotation.x = 0;
                leftSupport.castShadow = true;
                this.loomGroup.add(leftSupport);

                var rightSupport = leftSupport.clone();
                rightSupport.position.x = baseWidth / 2 - pillarSize;
                this.loomGroup.add(rightSupport);
            }

            this.loomGroup.position.y = 0;
            this.scene.add(this.loomGroup);
            return this.loomGroup;
        },
        buildWarpThreads: function (warpCount, visualSparse) {
            if (!this.isInitialized || !this.scene) return null;
            if (typeof warpCount === 'undefined') warpCount = 120;
            if (typeof visualSparse === 'undefined') visualSparse = true;

            var baseWidth = 6;
            var baseDepth = 5;
            var baseY = 0.1;
            var baseThickness = 0.2;
            var pillarHeight = 2.5;

            var logicCount = Math.min(warpCount, 120);
            var displayCount = logicCount;
            var displayStep = 1;
            if (visualSparse && warpCount > logicCount) {
                displayStep = Math.ceil(warpCount / logicCount);
            }

            if (warpCount > 600) {
                displayCount = 80;
                displayStep = Math.ceil(warpCount / displayCount);
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[Loom3DViewer] warpCount=' + warpCount + ' > 600, using LOD=' + displayCount + ' for visual rendering');
                }
            } else if (visualSparse) {
                displayCount = logicCount;
            } else {
                displayCount = warpCount;
                displayStep = 1;
            }

            var actualDisplayCount = Math.max(2, displayCount);
            this.warpDisplayCount = actualDisplayCount;
            this.warpDisplayStep = displayStep;

            if (this.warpGroup) {
                this.warpGroup.traverse(function (obj) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(function (m) { m.dispose(); });
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
                if (this.warpGroup.parent) {
                    this.warpGroup.parent.remove(this.warpGroup);
                }
            }

            this.warpGroup = new THREE.Group();
            this.warpGroup.name = 'warpGroup';
            this.warpLines = [];
            this.currentShedState = [];
            this.targetShedState = [];

            var warpBeamZ = -baseDepth / 2 + 0.4;
            var clothBeamZ = baseDepth / 2 - 0.4;
            var warpY = baseY + baseThickness + pillarHeight * 0.6;
            var clothY = baseY + baseThickness + pillarHeight * 0.5;
            var midZ = (warpBeamZ + clothBeamZ) / 2 - 0.3;
            var midBaseY = (warpY + clothY) / 2;
            var halfWidth = (baseWidth - 1.0) / 2;
            var spacing = (halfWidth * 2) / (actualDisplayCount - 1);

            var gold = [0.96, 0.90, 0.78];
            var darkGold = [0.79, 0.66, 0.38];

            var positions = new Float32Array(actualDisplayCount * 6 * 3);
            var colors = new Float32Array(actualDisplayCount * 6 * 3);
            var baseYs = new Float32Array(actualDisplayCount * 3);

            for (var i = 0; i < actualDisplayCount; i++) {
                var x = -halfWidth + i * spacing;
                var originalIndex = i * displayStep;
                var shedState = originalIndex % 2 === 0 ? 1 : 0;

                var baseYOffset = shedState === 1 ? 0.15 : -0.15;
                var midY = midBaseY + baseYOffset;

                var vIdx = i * 6;
                var cIdx = i * 6;
                var byIdx = i * 3;

                positions[vIdx * 3] = x;
                positions[vIdx * 3 + 1] = warpY;
                positions[vIdx * 3 + 2] = warpBeamZ;
                positions[(vIdx + 1) * 3] = x;
                positions[(vIdx + 1) * 3 + 1] = midY;
                positions[(vIdx + 1) * 3 + 2] = midZ;

                positions[(vIdx + 2) * 3] = x;
                positions[(vIdx + 2) * 3 + 1] = midY;
                positions[(vIdx + 2) * 3 + 2] = midZ;
                positions[(vIdx + 3) * 3] = x;
                positions[(vIdx + 3) * 3 + 1] = clothY;
                positions[(vIdx + 3) * 3 + 2] = clothBeamZ;

                var color = shedState === 1 ? gold : darkGold;
                for (var c = 0; c < 6; c++) {
                    colors[(cIdx + c) * 3] = color[0];
                    colors[(cIdx + c) * 3 + 1] = color[1];
                    colors[(cIdx + c) * 3 + 2] = color[2];
                }

                baseYs[byIdx] = warpY;
                baseYs[byIdx + 1] = midBaseY;
                baseYs[byIdx + 2] = clothY;

                this.currentShedState.push(shedState);
                this.targetShedState.push(shedState);
            }

            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            var material = new THREE.LineBasicMaterial({
                vertexColors: true,
                linewidth: 1,
                transparent: true,
                opacity: 0.95
            });

            var lineSegments = new THREE.LineSegments(geometry, material);
            lineSegments.name = 'warpLineSegments';
            this.warpGroup.add(lineSegments);

            this.warpLineSegments = lineSegments;
            this.warpPositionsAttr = geometry.attributes.position;
            this.warpColorsAttr = geometry.attributes.color;
            this.warpBaseYs = baseYs;

            this.warpThreads = this.warpGroup;
            this.scene.add(this.warpGroup);
            return this.warpGroup;
        },
        buildPatternMechanism: function () {
            if (!this.isInitialized || !this.scene) return null;

            var baseWidth = 6;
            var baseDepth = 5;
            var pillarHeight = 2.5;
            var baseY = 0.1;
            var baseThickness = 0.2;

            var topBeamY = baseY + baseThickness + pillarHeight;
            var flowerTowerHeight = 0.8;
            var flowerTowerWidth = baseWidth * 0.55;

            this.patternGroup = new THREE.Group();
            this.patternGroup.name = 'patternGroup';
            this.patternCards = [];

            var cardCount = 8;
            var cardWidth = flowerTowerWidth * 0.1;
            var cardHeight = 0.12;
            var cardDepth = baseDepth * 0.25;
            var cardSpacing = (flowerTowerWidth * 0.85) / (cardCount - 1);
            var cardColors = [
                0xe53935, 0x8e24aa, 0x3949ab, 0x00897b,
                0xfdd835, 0xfb8c00, 0x6d4c41, 0xc62828
            ];

            var cardBaseY = topBeamY + flowerTowerHeight * 0.2;

            for (var c = 0; c < cardCount; c++) {
                var cardX = -(flowerTowerWidth * 0.85) / 2 + c * cardSpacing;

                var cardCanvas = document.createElement('canvas');
                cardCanvas.width = 64;
                cardCanvas.height = 32;
                var cctx = cardCanvas.getContext('2d');
                var cr = (cardColors[c] >> 16) & 255;
                var cg = (cardColors[c] >> 8) & 255;
                var cb = cardColors[c] & 255;
                cctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
                cctx.fillRect(0, 0, 64, 32);
                cctx.fillStyle = 'rgba(255,255,255,0.15)';
                cctx.fillRect(0, 0, 64, 4);
                cctx.fillStyle = 'rgba(0,0,0,0.2)';
                cctx.fillRect(0, 28, 64, 4);
                for (var h = 0; h < 6; h++) {
                    cctx.fillStyle = 'rgba(0,0,0,0.4)';
                    cctx.beginPath();
                    cctx.arc(10 + h * 9, 16, 1.5, 0, Math.PI * 2);
                    cctx.fill();
                }
                var cardTexture = new THREE.CanvasTexture(cardCanvas);
                var cardMaterial = new THREE.MeshPhongMaterial({
                    map: cardTexture,
                    color: cardColors[c],
                    shininess: 30,
                    specular: 0x333333
                });
                var cardGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
                var card = new THREE.Mesh(cardGeo, cardMaterial);
                card.position.set(cardX, cardBaseY, 0);
                card.castShadow = true;
                card.userData = {
                    baseY: cardBaseY,
                    color: cardColors[c],
                    index: c
                };
                this.patternGroup.add(card);
                this.patternCards.push(card);
            }

            var threadCount = 40;
            var threadPositions = [];
            var threadHalfWidth = flowerTowerWidth * 0.4;
            var threadSpacing = (threadHalfWidth * 2) / (threadCount - 1);

            var harnessY = baseY + baseThickness + pillarHeight * 0.4;
            var topConnectY = topBeamY;

            var threadPositionsArray = new Float32Array(threadCount * 2 * 3);
            var threadColorsArray = new Float32Array(threadCount * 2 * 3);
            var purpleColor = new THREE.Color(0x9c27b0);
            var lightPurple = new THREE.Color(0xba68c8);

            for (var t = 0; t < threadCount; t++) {
                var tx = -threadHalfWidth + t * threadSpacing;
                var colorT = t / (threadCount - 1);
                var tc = purpleColor.clone().lerp(lightPurple, colorT);

                var idx = t * 2 * 3;
                threadPositionsArray[idx] = tx;
                threadPositionsArray[idx + 1] = topConnectY;
                threadPositionsArray[idx + 2] = 0;
                threadPositionsArray[idx + 3] = tx;
                threadPositionsArray[idx + 4] = harnessY;
                threadPositionsArray[idx + 5] = 0;

                threadColorsArray[idx] = tc.r;
                threadColorsArray[idx + 1] = tc.g;
                threadColorsArray[idx + 2] = tc.b;
                threadColorsArray[idx + 3] = tc.r;
                threadColorsArray[idx + 4] = tc.g;
                threadColorsArray[idx + 5] = tc.b;

                threadPositions.push({
                    x: tx,
                    baseTopY: topConnectY,
                    baseBottomY: harnessY,
                    currentOffset: 0,
                    targetOffset: 0
                });
            }

            var harnessGeo = new THREE.BufferGeometry();
            harnessGeo.setAttribute('position', new THREE.BufferAttribute(threadPositionsArray, 3));
            harnessGeo.setAttribute('color', new THREE.BufferAttribute(threadColorsArray, 3));
            var harnessMat = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.75
            });
            var harnessLinesMesh = new THREE.LineSegments(harnessGeo, harnessMat);
            harnessLinesMesh.name = 'harnessLines';
            harnessLinesMesh.userData = { positions: threadPositions };
            this.harnessLines = harnessLinesMesh;
            this.patternGroup.add(harnessLinesMesh);

            var connectorWidth = flowerTowerWidth * 0.7;
            var connectorBar = new THREE.Mesh(
                new THREE.BoxGeometry(connectorWidth, 0.03, 0.04),
                new THREE.MeshPhongMaterial({ color: 0x7b1fa2, shininess: 50 })
            );
            connectorBar.position.set(0, topConnectY, 0);
            this.patternGroup.add(connectorBar);

            this.scene.add(this.patternGroup);
            return this.patternGroup;
        },
        buildFabricRoll: function () {
            if (!this.isInitialized || !this.scene) return null;

            var baseWidth = 6;
            var baseDepth = 5;
            var baseY = 0.1;
            var baseThickness = 0.2;
            var pillarHeight = 2.5;

            var clothBeamZ = baseDepth / 2 - 0.4;
            var clothBeamRadius = 0.18;
            var clothY = baseY + baseThickness + pillarHeight * 0.5;
            var fabricWidth = baseWidth - 1.0;

            var fabricCanvas = document.createElement('canvas');
            fabricCanvas.width = 512;
            fabricCanvas.height = 256;
            var fctx = fabricCanvas.getContext('2d');

            var patternColors = [
                ['#c9a961', '#8b4513', '#c9a961', '#a0522d'],
                ['#d4af37', '#5d3a1a', '#daa520', '#6b4423'],
                ['#f5e6c8', '#8b6914', '#e8d4a8', '#a67c00']
            ];
            var colorSet = patternColors[0];
            fctx.fillStyle = colorSet[0];
            fctx.fillRect(0, 0, 512, 256);

            var cloudRows = 4;
            var cloudCols = 8;
            var cellW = 512 / cloudCols;
            var cellH = 256 / cloudRows;

            for (var r = 0; r < cloudRows; r++) {
                for (var cl = 0; cl < cloudCols; cl++) {
                    var cx = cl * cellW + cellW / 2;
                    var cy = r * cellH + cellH / 2;
                    var ci = (r + cl) % colorSet.length;
                    var grad = fctx.createRadialGradient(cx, cy, 2, cx, cy, Math.min(cellW, cellH) * 0.45);
                    grad.addColorStop(0, colorSet[ci]);
                    grad.addColorStop(0.5, this._hexToRgba(colorSet[(ci + 1) % colorSet.length], 0.6));
                    grad.addColorStop(1, this._hexToRgba(colorSet[ci], 0));
                    fctx.fillStyle = grad;
                    fctx.beginPath();
                    fctx.arc(cx, cy, Math.min(cellW, cellH) * 0.45, 0, Math.PI * 2);
                    fctx.fill();
                }
            }

            for (var dl = 0; dl < 20; dl++) {
                fctx.strokeStyle = dl % 2 === 0 ? 'rgba(139, 69, 19, 0.3)' : 'rgba(201, 169, 97, 0.4)';
                fctx.lineWidth = 0.5;
                fctx.beginPath();
                fctx.moveTo(0, dl * (256 / 20));
                fctx.lineTo(512, dl * (256 / 20));
                fctx.stroke();
            }
            for (var dv = 0; dv < 40; dv++) {
                fctx.strokeStyle = dv % 2 === 0 ? 'rgba(139, 69, 19, 0.25)' : 'rgba(245, 230, 200, 0.3)';
                fctx.lineWidth = 0.4;
                fctx.beginPath();
                fctx.moveTo(dv * (512 / 40), 0);
                fctx.lineTo(dv * (512 / 40), 256);
                fctx.stroke();
            }

            for (var bd = 0; bd < 3; bd++) {
                var borderY = bd === 0 ? 4 : (bd === 1 ? 252 : 128);
                var borderH = bd === 2 ? 4 : 4;
                fctx.fillStyle = bd === 2 ? 'rgba(139, 69, 19, 0.6)' : 'rgba(212, 175, 55, 0.7)';
                fctx.fillRect(0, borderY, 512, borderH);
            }

            var fabricTexture = new THREE.CanvasTexture(fabricCanvas);
            fabricTexture.wrapS = THREE.RepeatWrapping;
            fabricTexture.wrapT = THREE.RepeatWrapping;
            fabricTexture.repeat.set(4, 1);

            var fabricMaterial = new THREE.MeshPhongMaterial({
                map: fabricTexture,
                side: THREE.DoubleSide,
                shininess: 20,
                specular: 0x2a1a0a
            });

            var fabricGeo = new THREE.PlaneGeometry(fabricWidth, 0.01, 32, 1);
            this.fabricMesh = new THREE.Mesh(fabricGeo, fabricMaterial);
            this.fabricMesh.rotation.x = -Math.PI / 2;
            this.fabricMesh.rotation.z = 0;
            this.fabricMesh.position.set(
                0,
                clothY - clothBeamRadius - 0.02,
                (clothBeamZ + (baseY + baseThickness + pillarHeight * 0.6) * 0 + 0.2) - 0.6
            );
            this.fabricMesh.userData = {
                basePosition: this.fabricMesh.position.clone(),
                baseScaleZ: 1,
                maxLength: 3.2,
                clothBeamZ: clothBeamZ,
                clothBeamRadius: clothBeamRadius
            };
            this.fabricMesh.receiveShadow = true;
            this.fabricMesh.castShadow = false;
            this.fabricMesh.scale.z = 0.05;
            this.scene.add(this.fabricMesh);

            var wrapGeo = new THREE.CylinderGeometry(
                clothBeamRadius + 0.005,
                clothBeamRadius + 0.005,
                fabricWidth,
                48,
                1,
                true
            );
            var wrapMat = new THREE.MeshPhongMaterial({
                map: fabricTexture.clone(),
                side: THREE.DoubleSide,
                shininess: 15
            });
            wrapMat.map.repeat.set(2, 1);
            var wrapMesh = new THREE.Mesh(wrapGeo, wrapMat);
            wrapMesh.rotation.z = Math.PI / 2;
            wrapMesh.position.set(0, clothY, clothBeamZ);
            wrapMesh.name = 'fabricWrap';
            wrapMesh.userData = { isWrap: true };
            this.scene.add(wrapMesh);
            this.fabricWrap = wrapMesh;

            this.fabricProgress = 0;
            return this.fabricMesh;
        },
        _hexToRgba: function (hex, alpha) {
            var h = hex.replace('#', '');
            if (h.length === 3) {
                h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
            }
            var r = parseInt(h.substring(0, 2), 16);
            var g = parseInt(h.substring(2, 4), 16);
            var b = parseInt(h.substring(4, 6), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        },
        _updateWarpGeometry: function (shedArray, progress) {
            if (!this.warpLineSegments || !this.warpPositionsAttr || !this.warpColorsAttr || !this.warpBaseYs) return;
            if (typeof progress === 'undefined') progress = 1.0;

            var positions = this.warpPositionsAttr.array;
            var colors = this.warpColorsAttr.array;
            var baseYs = this.warpBaseYs;
            var count = this.warpDisplayCount;

            var gold = [0.96, 0.90, 0.78];
            var darkGold = [0.79, 0.66, 0.38];

            for (var i = 0; i < count; i++) {
                var displayStep = this.warpDisplayStep || 1;
                var logicalIdx = i * displayStep;
                var shed = 0.5;
                if (shedArray && shedArray.length > 0) {
                    var idx = Math.min(logicalIdx, shedArray.length - 1);
                    shed = shedArray[idx] !== undefined ? shedArray[idx] : 0.5;
                } else {
                    shed = logicalIdx % 2 === 0 ? 1 : 0;
                }

                var yOffset;
                var color;
                if (shed >= 0.6) {
                    var s = Math.min(1, (shed - 0.6) / 0.4);
                    yOffset = 0.20 * s;
                    color = gold;
                } else if (shed <= 0.4) {
                    var s0 = Math.min(1, (0.4 - shed) / 0.4);
                    yOffset = -0.20 * s0;
                    color = darkGold;
                } else {
                    yOffset = 0;
                    var tColor = (shed - 0.4) / 0.2;
                    color = [
                        this._lerp(darkGold[0], gold[0], tColor),
                        this._lerp(darkGold[1], gold[1], tColor),
                        this._lerp(darkGold[2], gold[2], tColor)
                    ];
                }

                var byIdx = i * 3;
                var midBaseY = baseYs[byIdx + 1];
                var midY = midBaseY + yOffset;

                var vIdx = i * 6;
                positions[(vIdx + 1) * 3 + 1] = midY;
                positions[(vIdx + 2) * 3 + 1] = midY;

                var cIdx = i * 6;
                for (var c = 0; c < 6; c++) {
                    var cc = (cIdx + c) * 3;
                    colors[cc] = color[0];
                    colors[cc + 1] = color[1];
                    colors[cc + 2] = color[2];
                }
            }

            this.warpPositionsAttr.needsUpdate = true;
            this.warpColorsAttr.needsUpdate = true;
        },
        updateShedOpening: function (shedArray) {
            if (!this.isInitialized) return;
            if (!shedArray || !shedArray.length) return;

            var stateCount = this.currentShedState.length;
            var len = Math.min(stateCount, shedArray.length);
            for (var i = 0; i < len; i++) {
                this.targetShedState[i] = shedArray[i];
            }
            this.shedAnimProgress = 0;
            this._shedAnimDuration = 0.3;
            this._shedAnimStart = performance.now();
        },
        _updateShedAnimation: function () {
            if (!this.warpLineSegments) return;
            if (this.currentShedState.length === 0) return;

            var now = performance.now();
            var duration = (this._shedAnimDuration || 0.3) * 1000;
            var start = this._shedAnimStart || 0;
            var t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
            var eased = this._easeOutCubic(t);

            var count = this.currentShedState.length;
            var interpolated = new Array(count);
            for (var i = 0; i < count; i++) {
                var currentState = this.currentShedState[i] !== undefined ? this.currentShedState[i] : 0.5;
                var targetState = this.targetShedState[i] !== undefined ? this.targetShedState[i] : 0.5;
                interpolated[i] = this._lerp(currentState, targetState, eased);

                if (t >= 1) {
                    this.currentShedState[i] = targetState;
                }
            }

            this._updateWarpGeometry(interpolated, eased);
        },
        animatePattern: function (patternPos) {
            if (!this.isInitialized || !this.patternCards || this.patternCards.length === 0) return;

            var normalized = (patternPos !== undefined && patternPos !== null) ? patternPos : 0;
            normalized = Math.max(0, Math.min(1, normalized));

            this.patternAnimState.targetPos = normalized;
            this.patternAnimState.progress = 0;
            this.patternAnimState.startTime = performance.now();
            this.patternAnimState.duration = 0.5;
        },
        _updatePatternAnimation: function () {
            if (!this.patternCards || this.patternCards.length === 0) return;

            var state = this.patternAnimState;
            var now = performance.now();
            var duration = (state.duration || 0.5) * 1000;
            var start = state.startTime || 0;
            var t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
            var eased = this._easeOutCubic(t);

            var current = this._lerp(state.currentPos, state.targetPos, eased);

            if (t >= 1) {
                state.currentPos = state.targetPos;
                state.progress = 1;
            } else {
                state.progress = t;
            }

            for (var i = 0; i < this.patternCards.length; i++) {
                var card = this.patternCards[i];
                if (!card || !card.userData) continue;
                var baseY = card.userData.baseY || 0;
                var phase = (i / this.patternCards.length + current) % 1;
                var offset = Math.sin(phase * Math.PI * 2) * 0.18 + Math.sin(phase * Math.PI * 4 + current * 3) * 0.06;
                card.position.y = baseY + offset;
            }

            if (this.harnessLines && this.harnessLines.geometry) {
                var positions = this.harnessLines.geometry.attributes.position;
                var threadData = this.harnessLines.userData.positions;
                if (positions && threadData) {
                    for (var t2 = 0; t2 < threadData.length; t2++) {
                        var td = threadData[t2];
                        var idx = t2 * 2 * 3;
                        var phase2 = (t2 / threadData.length + current) % 1;
                        var threadOffset = Math.sin(phase2 * Math.PI * 2) * 0.08;
                        positions.setY(idx + 4, td.baseBottomY + threadOffset);
                    }
                    positions.needsUpdate = true;
                }
            }
        },
        updateFabricProgress: function (progress) {
            if (!this.isInitialized || !this.fabricMesh) return;

            var p = progress !== undefined ? progress : 0;
            p = Math.max(0, Math.min(1, p));
            this.fabricProgress = p;

            if (this.fabricMesh.userData) {
                var maxLength = this.fabricMesh.userData.maxLength || 3;
                var minScale = 0.05;
                var newScale = minScale + p * (maxLength - minScale);
                this.fabricMesh.scale.z = newScale;

                var clothBeamZ = this.fabricMesh.userData.clothBeamZ || 0;
                this.fabricMesh.position.z = clothBeamZ - newScale / 2 - 0.15;
            }

            if (this.fabricWrap) {
                var wrapScale = 1 + p * 0.15;
                this.fabricWrap.scale.set(wrapScale, 1, wrapScale);
            }
        },
        buildAll: function () {
            if (!this.isInitialized) return;

            this.buildLoomModel();
            this.buildWarpThreads(120, true);
            this.buildPatternMechanism();
            this.buildFabricRoll();
        },
        animate: function () {
            if (!this.isInitialized) return;

            var self = this;
            var tick = function () {
                self.animationId = requestAnimationFrame(tick);

                if (self.controls) {
                    self.controls.update();
                }

                self._updateShedAnimation();
                self._updatePatternAnimation();

                if (self.harnessFrame) {
                    var sway = Math.sin(performance.now() * 0.0008) * 0.02;
                    self.harnessFrame.position.z = sway;
                    self.harnessFrame.rotation.x = Math.sin(performance.now() * 0.001) * 0.015;
                }

                if (self.onTickCallback && typeof self.onTickCallback === 'function') {
                    try {
                        self.onTickCallback(performance.now());
                    } catch (e) {
                    }
                }

                if (self.renderer && self.scene && self.camera) {
                    self.renderer.render(self.scene, self.camera);
                }
            };
            tick();
        },
        setOnTick: function (callback) {
            this.onTickCallback = callback;
        },
        dispose: function () {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }

            if (this.warpGroup) {
                this.warpGroup.traverse(function (obj) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(function (m) { m.dispose(); });
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
            }

            if (this.patternGroup) {
                this.patternGroup.traverse(function (obj) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(function (m) { m.dispose(); });
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
            }

            if (this.loomGroup) {
                this.loomGroup.traverse(function (obj) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(function (m) { m.dispose(); });
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
            }

            if (this.fabricMesh) {
                if (this.fabricMesh.geometry) this.fabricMesh.geometry.dispose();
                if (this.fabricMesh.material) {
                    if (this.fabricMesh.material.map) this.fabricMesh.material.map.dispose();
                    this.fabricMesh.material.dispose();
                }
            }

            if (this.scene) {
                while (this.scene.children.length > 0) {
                    this.scene.remove(this.scene.children[0]);
                }
            }

            if (this.controls) {
                this.controls.dispose();
                this.controls = null;
            }

            if (this.renderer) {
                this.renderer.dispose();
                if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                    this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
                }
                this.renderer = null;
            }

            this.scene = null;
            this.camera = null;
            this.warpGroup = null;
            this.warpThreads = null;
            this.warpLineSegments = null;
            this.warpPositionsAttr = null;
            this.warpColorsAttr = null;
            this.warpBaseYs = null;
            this.warpDisplayCount = 0;
            this.warpDisplayStep = 1;
            this.patternGroup = null;
            this.patternCards = [];
            this.warpLines = [];
            this.harnessLines = [];
            this.fabricMesh = null;
            this.fabricWrap = null;
            this.loomGroup = null;
            this.harnessFrame = null;
            this.currentShedState = [];
            this.targetShedState = [];
            this.isInitialized = false;
            this.container = null;
        }
    };

    global.Loom3DViewer = Loom3DViewer;

})(typeof window !== 'undefined' ? window : this);
