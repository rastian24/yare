var harvester_og = 200; //Total energy capacity in the original star
var energize_dist = 200;
var defenders = 1;

function init(){
    og_base = eval(bases[my_spirits[0].sight.structures]);
    og_region = og_base.id.slice(-3);
    og_star = eval(stars['star_' + og_region]);
}

function set_region(spirit, region){
    console.log("Setting Region...")
    spirit.set_mark(region);
    memory[spirit.id].base = eval('base_' + region);
    memory[spirit.id].star = eval('star_' + region);
    console.log("Region set...");
}

function set_role(spirit){ 
    console.log("Setting role...");
    //Default mark and location
    set_region(spirit, "nua");

    if(count_mark(og_region)*spirit.energy_capacity < harvester_og){
        set_region(spirit,og_region);
    }
    console.log("Rol seteado");
}

function set_new_spirit(spirit){
    console.log("Setting new spirit...");
    if(!memory[spirit.id]){
        memory[spirit.id] = {};
        memory[spirit.id].task = "deposit";
        set_role(spirit);
    }
    console.log("New spirit set.");
}

function new_spirit(spirit){
    if(!memory[spirit.id]){
        return true;
    }
    return false;
}

function count_mark(mark){
    let count = 0;
    for (let i = 0; i < my_spirits.length; i++) {
        spirit = my_spirits[i];
        if (spirit.mark == mark && spirit.hp == 1){
            count += 1;
        }
    }
    return count;
}

function harvest(location) {
    if (spirit.energy < spirit.energy_capacity) {
        if (distance(spirit.position, location.position) > energize_dist) {
            spirit.move(location.position);
        }
        spirit.energize(spirit)
    }
    if (spirit.energy == spirit.energy_capacity) {
        memory[spirit.id].task = "deposit";
    }
}

function deposit(){
    destination = memory[spirit.id].base;
    if (spirit.energy > spirit.energy_capacity / 10){
        if (distance(spirit.position, destination.position) > energize_dist) {
            spirit.move(destination.position);
        }
        spirit.energize(destination);
    }
    if (spirit.energy <= spirit.energy_capacity / 10) {
        memory[spirit.id].task = "harvest";
    }
}


function distance(a, b) {
    d = Math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2);
    return d;
}

//MAIN
if (tick == 1) {
   init(); 
   console.log("Init");
}

console.log(count_mark(og_region));

for(i=0;i<my_spirits.length;i++){
    spirit = my_spirits[i];
    if(new_spirit(spirit)){
        set_new_spirit(spirit);
    }
    
    console.log(distance(spirit.position, memory[spirit.id].base.position));
    if (memory[spirit.id].task == "harvest") {
       harvest(memory[spirit.id].star);
    }
    if (memory[spirit.id].task == "deposit"){
        deposit();
    }
    if (spirit.sight.enemies_beamable.length > 0){
        spirit.energize(spirit.sight.enemies_beamable[0]);
    }
    console.log("Looking good...");
}