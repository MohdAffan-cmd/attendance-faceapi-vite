function markAttendance() {

let name = document.getElementById("name").value;

if(name === "") {
alert("Enter Name");
return;
}

let list = document.getElementById("list");

let item = document.createElement("li");

let time = new Date().toLocaleTimeString();

item.innerHTML = name + " - Present - " + time;

list.appendChild(item);

document.getElementById("name").value = "";
}
