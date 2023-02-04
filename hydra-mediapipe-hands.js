{
    const getHydra = function () {
        const whereami = window.choo?.state?.hydra
            ? "editor"
            : window.atom?.packages
            ? "atom"
            : "idk";
        switch (whereami) {
            case "editor":
                return choo.state.hydra.hydra;
            case "atom":
                return global.atom.packages.loadedPackages["atom-hydra"]
                    .mainModule.main.hydra;
            case "idk":
                let _h = undefined;
                _h = window._hydra?.regl ? window._hydra : _h;
                _h = window.hydra?.regl ? window.hydra : _h;
                _h = window.h?.regl ? window.h : _h;
                _h = window.H?.regl ? window.H : _h;
                _h = window.hy?.regl ? window.hy : _h;
                return _h;
        }
    };
    window._hydra = getHydra();
    window._hydraScope = _hydra.sandbox.makeGlobal ? window : _hydra;
}

async function main() {
    await loadScript(
        "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js"
    );
    await import(
        "https://cdn.jsdelivr.net/gh/hydra-synth/hydra-synth/src/lib/webcam.js"
    ).then((m) => (window.Webcam = m.default));

    const _hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
        },
    });
    _hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });
    _hands.initialized = false;
    _hands.currentSource = null;
    _hands.frameCounter = 0;
    _hands.frameUpdate = 2;

    const range = (x, min, max) => x * (max - min) + min;
    const hydrate = (x) => range(x, 0.5, -0.5);
    function getPalm(hand) {
        const ret = {};
        ret.x = (hand[0].x + hand[9].x * 2) / 3;
        ret.y = (hand[0].y + hand[9].y * 2) / 3;
        ret.z = (hand[0].z + hand[9].z * 2) / 3;
        return ret;
    }
    const onResults = (results) => {
        const _hands = results.multiHandLandmarks;
        if (_hands.length) {
            for (let i = 0; i < _hands.length; i += 1) {
                const hand = _hands[i];
                for (point of hand) {
                    point.x = hydrate(point.x);
                    point.y = hydrate(point.y);
                }
                hand.palm = getPalm(hand);
                window.hands[i] = hand;
            }
        }
    };
    _hands.onResults(onResults);

    const hS = _hydra.s[0].constructor.prototype;

    function updateHands() {
        if (_hands.currentSource.src?.videoWidth && !_hands.frameCounter) {
            _hands.send({ image: _hands.currentSource.src });
        }
        _hands.frameCounter += 1;
        _hands.frameCounter %= _hands.frameUpdate;
        _hands.frameCounter = _hands.frameCounter || 1;
    }
    function initHands() {
        _hands.send({ image: _hands.currentSource.src }).then(() => {
            _hands.initialized = true;
            window._updateChain.push(updateHands);
        });
    }

    hS.initHands = function (cameraIndex, params) {
        const self = this;
        Webcam(cameraIndex)
            .then((response) => {
                self.src = response.video;
                self.dynamic = true;
                self.tex = self.regl.texture({ data: self.src, ...params });
                _hands.currentSource = this;
                if (!_hands.initialized) initHands();
            })
            .catch((err) => console.log("could not get camera", err));
        _hands.currentSource = this;
    };

    if (!window._updateChain) {
        window.update = window.update || ((dt) => {});
        window._updateChain = [() => window["update"]()];
        _hydra.sandbox.userProps = ["speed", "bpm", "fps"];
        _hydra.synth.update = (dt) => {
            const chain = window._updateChain;
            for (func of chain) {
                func(dt);
            }
        };
    }

    window.hydraHands = {};
    hydraHands.setFrameUpdate = function(frameUpdate){
        _hydra.frameUpdate = frameUpdate;
    }
}

{
    window.hands = [
        Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })),
        Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })),
    ];
    window.hands[0].palm = { x: 0, y: 0, z: 0 };
    window.hands[1].palm = { x: 0, y: 0, z: 0 };

    const gS = _hydraScope.osc().constructor.prototype;
    gS.followHand = function (whichHand = 0, mult = 1) {
        return this.scroll(
            () => hands[whichHand].palm.x * mult,
            () => hands[whichHand].palm.y * mult
        );
    };
}

main();
