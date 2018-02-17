const dp = drawpoint;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const W = screen.width;
const H = screen.height;

canvas.id = "display";
canvas.width = W;
canvas.height = H;
document.body.appendChild(canvas);


const strings = {
    duration  : 10,
    numPts    : 10,
    numStrings: 1,
    size      : 0.5,
    order     : 1,
    smoothness: 0,

    pts: [],
    initPts() {
        ctx.clearRect(0, 0, W, H);
        this.pts = [];
        const offsetW = (1 - this.size) * W / 2;
        const offsetH = (1 - this.size) * H / 2;
        while (this.pts.length < this.numPts) {
            this.pts.push(
                dp.point(offsetW + Math.random() * W * this.size, offsetH + Math.random() * H *
                                                                  this.size));
            // reduce to a nicer initial shape by being convex and non-intersecting
            this.pts = convexHull(this.pts);
        }
        // TODO add control points for each point corresponding to order

        ctx.beginPath();
        dp.drawPoints(ctx, ...this.pts, this.pts[0]);
        ctx.stroke();

        // TODO calculate positions of points over time with constraint of being back after duration
    },

    // TODO animate

    reroll() {
        console.log('reroll');
        this.initPts();
    },
    "save to GIF"() {
        console.log("save to GIF");
        // TODO
    }
};

strings.initPts();

const gui = new dat.GUI();
gui.add(strings, 'duration', 0, 20);
gui.add(strings, 'numPts', 0, 20);
gui.add(strings, 'numStrings', 1, 3);
gui.add(strings, 'size', 0, 1);
gui.add(strings, 'order', 1, 3);
gui.add(strings, 'smoothness', 0, 5);
gui.add(strings, 'reroll');
gui.add(strings, 'save to GIF');


