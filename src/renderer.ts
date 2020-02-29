import { Line, Svg } from 'chartist';
import { Engine, Render, World, Bodies, Runner, Body, Vector } from 'matter-js';

const Vector2 = Vector.create;

/*
 
*   ____            _           _      ____             __ _                       _   _             
*  |  _ \ _ __ ___ (_) ___  ___| |_   / ___|___  _ __  / _(_) __ _ _   _ _ __ __ _| |_(_) ___  _ __  
*  | |_) | '__/ _ \| |/ _ \/ __| __| | |   / _ \| '_ \| |_| |/ _` | | | | '__/ _` | __| |/ _ \| '_ \ 
*  |  __/| | | (_) | |  __/ (__| |_  | |__| (_) | | | |  _| | (_| | |_| | | | (_| | |_| | (_) | | | |
*  |_|   |_|  \___// |\___|\___|\__|  \____\___/|_| |_|_| |_|\__, |\__,_|_|  \__,_|\__|_|\___/|_| |_|
*                |__/                                        |___/                                   
 
*/
//? Energy
const TOTAL_ENERGY = 1_000_000;
const INITIAL_HEARTSOUL_ENERGY = 128;
const INITIAL_POPULATION = 1024;
const SIZE_INCREASING = .001;

const SPEED_COST = 1;
const LIVING_BASE_COST = 1;
let LIVING_COST = 1;
const REPRODUCTION_ENERGY = INITIAL_HEARTSOUL_ENERGY * 2;

//? Genetics
const MUTATION_RATE = .25;
const MUTATION_RANGE = .00125;

//? Canvas
const CANVAS_WIDTH = window.innerWidth || 800;
const CANVAS_HEIGHT = window.innerHeight || 600;

const PIECE_SIZE = 2;
const SPEED = LIVING_BASE_COST/2;


/*
 
*    ____                _              _     _____                 _   _                 
*   / ___|___  _ __  ___| |_ __ _ _ __ | |_  |  ___|   _ _ __   ___| |_(_) ___  _ __  ___ 
*  | |   / _ \| '_ \/ __| __/ _` | '_ \| __| | |_ | | | | '_ \ / __| __| |/ _ \| '_ \/ __|
*  | |__| (_) | | | \__ \ || (_| | | | | |_  |  _|| |_| | | | | (__| |_| | (_) | | | \__ \
*   \____\___/|_| |_|___/\__\__,_|_| |_|\__| |_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
                                                                                         
 
*/

const TANH = (z: number) => Math.tanh(z);
const RANDOM_WEIGHT = () => Math.random() * 2 - 1;
const clamp = (n: number, max: number, min: number = 0) => n > max? max : n < min?  min : n;

/*
 
*   _   _ _   _ _ _ _           _____                 _   _                 
*  | | | | |_(_) (_) |_ _   _  |  ___|   _ _ __   ___| |_(_) ___  _ __  ___ 
*  | | | | __| | | | __| | | | | |_ | | | | '_ \ / __| __| |/ _ \| '_ \/ __|
*  | |_| | |_| | | | |_| |_| | |  _|| |_| | | | | (__| |_| | (_) | | | \__ \
*   \___/ \__|_|_|_|\__|\__, | |_|   \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
*                       |___/                                               
 
*/

function randomCouncil (size: number, names: string[] = []) {
    const neurons: Neuron[] = [];

    for(let i=0;i<size;i++)
        neurons.push(new Neuron);
    
    return new Council(neurons, names);
}

function randomNamedCouncil (names: string[]) {
    return randomCouncil(names.length, names);
}

/*
 
*    ____                 _     _         ____ _                         
*   / ___|_ __ __ _ _ __ | |__ (_) ___   / ___| | __ _ ___ ___  ___  ___ 
*  | |  _| '__/ _` | '_ \| '_ \| |/ __| | |   | |/ _` / __/ __|/ _ \/ __|
*  | |_| | | | (_| | |_) | | | | | (__  | |___| | (_| \__ \__ \  __/\__ \
*   \____|_|  \__,_| .__/|_| |_|_|\___|  \____|_|\__,_|___/___/\___||___/
*                  |_|                                                   
 
*/

class HeartSoul {

    livingTimes: number = 0;
    energy: number = INITIAL_HEARTSOUL_ENERGY;

    element: Body;
    brain: Council;
    geoposition: Council;
    motor: Council;
    size: number;

    dead: boolean = false;
    pregnant: boolean = false;

    color: number[];

    constructor (options: { x?: number, y?: number, brain?: Council, geoposition?: Council, motor?: Council, color?: number[], size?: number }) {
        this.size = (options.size ?? PIECE_SIZE);
        this.color = options.color ?? [Math.random() * 255, Math.random() * 255, Math.random() * 255];

        this.element = Bodies.circle(
            options.x ?? Math.floor(Math.random() * CANVAS_WIDTH) - PIECE_SIZE/2,
            options.y ?? Math.floor(Math.random() * CANVAS_HEIGHT) - PIECE_SIZE/2,
            this.size,
            {
                render: {
                    fillStyle: `rgb(${this.color.join(', ')})`
                },
                mass: this.size ** 2
            }
        );

        this.brain = options.brain ?? randomCouncil(10, ['geoposition', 'motor']);
        this.geoposition = options.geoposition ?? randomNamedCouncil(['x', 'y', 'w', 'h', 'speedX', 'speedY'])
            .set('w', CANVAS_WIDTH)
            .set('h', CANVAS_HEIGHT);
        this.motor = options.motor ?? randomNamedCouncil(['x', 'y']);

        this.brain
            // .get('geoposition')
            .linkMany(this.geoposition.neurons);
            
        this.motor.link(this.brain.get('motor'))
    }

    update () {
        const { x, y } = this.element.velocity;

        if(isNaN(x) || isNaN(y)) return this.dead = true;
        this.element.render.opacity = this.energy > INITIAL_HEARTSOUL_ENERGY? 1 : (this.energy && this.energy/INITIAL_HEARTSOUL_ENERGY);
        
        this.geoposition
            .set('x', this.element.position.x)
            .set('y', this.element.position.y)
            .set('speedX', this.element.velocity.x)
            .set('speedY', this.element.velocity.y);

        this.brain.update();
        this.motor.update();

        Body.setVelocity(
            this.element,
            Vector2(
                x + this.motor.get('x').value * SPEED,
                y + this.motor.get('y').value * SPEED
            )
        );

        this.energy += Math.sqrt(x*x+y*y) * SPEED_COST;
        this.energy -= LIVING_COST;
        
        if(
            this.energy <= 0 || 
            this.element.position.x <= this.size || 
            this.element.position.x >= CANVAS_WIDTH - this.size || 
            this.element.position.y <= this.size || 
            this.element.position.y >= CANVAS_HEIGHT - this.size
        ) {
            this.energy = 0;
            this.dead = true;
        } else if(this.energy > REPRODUCTION_ENERGY) {
            this.pregnant = true;
        }

        this.livingTimes++;
        this.element.circleRadius = (this.energy/INITIAL_HEARTSOUL_ENERGY) * this.size;
    }
}

function generateWorld (): any {
    const engine = Engine.create();
    const world = engine.world;
    const render = Render.create({
        element: document.body,
        engine,
        options: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            wireframes: false
        }
    });
    
    world.gravity.y = 0;
    
    World.add(world, [
        Bodies.rectangle(-CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT, { isStatic: true }),
        Bodies.rectangle(CANVAS_WIDTH/2, -CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT, { isStatic: true }),
        Bodies.rectangle(3*CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT, { isStatic: true }),
        Bodies.rectangle(CANVAS_WIDTH/2, 3*CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT, { isStatic: true }),
    ]);
    
    Engine.run(engine);
    Render.run(render);

    return { engine, world, render, label };
}

function generateSoul (parent?: HeartSoul) {
    let size = parent?.size? parent.size + Math.random() > MUTATION_RATE? 0 : (Math.random() > .5? 1 : -1) :  Math.floor(Math.random() * PIECE_SIZE);
    size = size < 2? 2 : size;
    const soul = new HeartSoul({
        size: size,

        x: parent?.element.position.x,
        y: parent?.element.position.y,

        brain: parent?.brain.clone(MUTATION_RATE, MUTATION_RANGE),
        geoposition: parent?.geoposition.clone(MUTATION_RATE, MUTATION_RANGE),
        motor: parent?.motor.clone(MUTATION_RATE, MUTATION_RANGE),
        color: parent?.color && [...parent?.color].map(x => clamp(Math.random() > MUTATION_RANGE? x : Math.random() > .5? x + 1 : x - 1, 255))
    });

    souls.add(soul);
    World.add(world, soul.element);

    return soul;
}

/*
 
*    ____ _                         
*   / ___| | __ _ ___ ___  ___  ___ 
*  | |   | |/ _` / __/ __|/ _ \/ __|
*  | |___| | (_| \__ \__ \  __/\__ \
*   \____|_|\__,_|___/___/\___||___/
                                   
 
*/
class Neuron {

    //? State Variables
    value: number = 0;

    //? Genetic Variables
    links: Map<Neuron, number> = new Map();
    bias: number;

    constructor (bias?: number) {
        this.bias = bias ?? RANDOM_WEIGHT();
    }

    link (neuron: Neuron, value?: number) {
        this.links.set(neuron, value ?? Math.random() * 2 - 1);
        return this;
    }

    linkMany (neuron: Neuron[], values?: Array<number>) {
        neuron.forEach((n, i) => this.link(n, values && values[i]));
        
        return this;
    }

    unlink (neuron: Neuron) {
        this.links.delete(neuron);
        return this;
    }

    activate () {
        let value = this.bias;

        for(const [link, val] of this.links) {
            // if(!link) debugger;
            value += link.value * val;
        }

        this.value = TANH(value);

        return this;
    }
}

class Council {
    names: string[];
    neurons: Neuron[];
    neuronsMap: { [key: string]: Neuron };

    constructor (neurons: Neuron[], names: string[] = []) {
        this.neurons = [];
        this.neuronsMap = {};
        this.names = names;

        neurons.forEach(neuron => {
            this.neurons.push(neuron)
            neurons.forEach(n => neuron !== n && neuron.link(n));
        });

        names.forEach((name, index) => this.neuronsMap[name] = this.neurons[index]);
    }

    get (name: string) {
        return this.neuronsMap[name];
    }

    set (name: string, value: number) {
        this.neuronsMap[name].value = value;
        return this;
    }

    link (neuron: Neuron) {
        this.neurons.forEach(n => n.link(neuron));
        return this;
    }

    linkMany(neurons: Neuron[]) {
        this.neurons.forEach(n => n.linkMany(neurons));
        return this;
    }

    update () {
        this.neurons.forEach(n => n.activate());
        return this;
    }

    clone (mutation_rate: number = 0, mutation_range: number = 0) {
        const { neurons } = this;
        const shadowClones: Map<Neuron, Neuron> = new Map();

        for(const neuron of neurons)
            shadowClones.set(neuron, new Neuron(neuron.bias))
        for(const [parentNeuron, childrenNeuron] of shadowClones) {
            for(const [link, value] of parentNeuron.links) {
                if(!shadowClones.get(link)) continue;
                childrenNeuron.link(shadowClones.get(link), Math.random() < mutation_rate? value + (Math.random() * mutation_range - mutation_range/2): value);
            }
        }
        
        return new Council(neurons.map(x => shadowClones.get(x)), this.names)
    }
}

/*
 
*   __  __       _       
*  |  \/  | __ _(_)_ __  
*  | |\/| |/ _` | | '_ \ 
*  | |  | | (_| | | | | |
*  |_|  |_|\__,_|_|_| |_|                       
 
*/

const { world, label } = generateWorld();
const souls: Set<HeartSoul> = new Set();

for(let i=0;i<INITIAL_POPULATION;i++) {
    generateSoul();
}

setInterval(function () {
    LIVING_COST = LIVING_BASE_COST * (souls.size/INITIAL_POPULATION);
    
    for (const soul of souls) {
        soul.update();
    }

    for(const soul of souls) {
        if(soul.dead) {
            World.remove(world, soul.element);
            souls.delete(soul);

            if(souls.size < INITIAL_POPULATION) generateSoul();
        }
    }

    for(const soul of souls) {
        if(soul.pregnant) {
            generateSoul(soul);
            soul.energy -= INITIAL_HEARTSOUL_ENERGY;
            soul.pregnant = false;
        }
    }
}, 100);