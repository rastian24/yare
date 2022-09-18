function init(){
    my_base = eval(bases[my_spirits[0].sight.structures]);
    my_star = eval(stars['star_'+my_base.id.slice(-3)]);
}

function harvest() {
    
}
if (tick == 1) {
   init(); 
   console.log("Init");
}
             
for(i=0;i<my_spirits.length;i++){
    spirit = my_spirits[i];
    if (!memory[spirit.id]){
        memory[spirit.id] = {};
        memory[spirit.id].task = "deposit";
    }
    if (memory[spirit.id].task == "harvest" && spirit.energy < spirit.energy_capacity) {
        spirit.move(my_star.position);
        spirit.energize(spirit)
    }
    if (memory[spirit.id].task == "harvest" && spirit.energy == spirit.energy_capacity) {
        memory[spirit.id].task = "deposit";
    }
    if (memory[spirit.id].task == "deposit" && spirit.energy > spirit.energy_capacity / 10){
        spirit.move(my_base.position);
        spirit.energize(my_base);
    }
    if (memory[spirit.id].task == "deposit" && spirit.energy <= spirit.energy_capacity / 10) {
       memory[spirit.id].task = "harvest"; 
    }
    console.log("Loop");
}





