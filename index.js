const dp = drawpoint;
const canvas = document.createElement("canvas");
const ctx = new Context2DTracked(canvas.getContext("2d"));
const W = screen.width;
const H = screen.height;

canvas.id = "display";
canvas.width = W;
canvas.height = H;
document.body.appendChild(canvas);

function indexWrap(a, i) {
    return (a.length + i) % a.length;
}

const strings = {
    seed      : 'randomness',
    duration  : 10,
    numPts    : 10,
    numStrings: 1,
    size      : 0.5,
    order     : 3,
    smooth    : true,

    pts: [],
    randPoint() {
        const offsetW = (1 - this.size) * W / 2;
        const offsetH = (1 - this.size) * H / 2;
        return dp.point(offsetW + Math.random() * W * this.size, offsetH + Math.random() * H *
                                                                 this.size);
    },
    initPts(seed) {
        ctx.clearRect(0, 0, W, H);

        this.seed = seed;
        Math.seedrandom(this.seed);

        this.pts = [];
        while (this.pts.length < this.numPts) {
            this.pts.push(this.randPoint());
            // reduce to a nicer initial shape by being convex and non-intersecting
            this.pts = convexHull(this.pts);
        }
        this.pts.forEach(pt => {
            // no control points for linear
            if (this.order === 1) {
                return;
            }
            pt.cp1 = this.randPoint();
            if (this.order === 3) {
                pt.cp2 = this.randPoint();
            }
        });
        // smooth the first point
        if (this.smooth) {
            this.pts.forEach((pt, i) => {
                this.pts[i].cp1 =
                    dp.continueCurve(this.pts[indexWrap(this.pts, i - 2)],
                        this.pts[indexWrap(this.pts, i - 1)],
                        1);
            });
            this.pts.forEach((pt, i) => {
                this.pts[i].cp1 =
                    dp.continueCurve(this.pts[indexWrap(this.pts, i - 2)],
                        this.pts[indexWrap(this.pts, i - 1)],
                        1);
            });
        }

        ctx.beginPath();
        dp.drawPoints(ctx, ...this.pts, this.pts[0]);
        ctx.stroke();

        // TODO calculate positions of points over time with constraint of being back after duration
    },

    // TODO animate

    reroll() {
        console.log('reroll');
        this.initPts(new Date().getTime());
    },
    "save to GIF"() {
        console.log("save to GIF");
        // TODO
    }
};

strings.initPts('hello');

const gui = new dat.GUI();
gui.add(strings, 'seed').listen();
gui.add(strings, 'duration', 0, 20);
gui.add(strings, 'numPts', 0, 20).step(1);
gui.add(strings, 'numStrings', 1, 3).step(1);
gui.add(strings, 'size', 0, 1);
gui.add(strings, 'order', 1, 3).step(1);
gui.add(strings, 'smooth');
gui.add(strings, 'reroll');
gui.add(strings, 'save to GIF');


