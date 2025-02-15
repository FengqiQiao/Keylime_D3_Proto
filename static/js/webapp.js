/*
* SPDX-License-Identifier: Apache-2.0
* Copyright 2017 Massachusetts Institute of Technology.
*/

'use strict';
let API_VERSION=2;
let MAX_TERM_LEN=100;
let DEBUG=false;
let gTerminalOffset=0;


// Report that error occurred
function reportIssue(issueStr) {
	if (!DEBUG) return;
	if (window.console && window.console.log) {
		console.log(issueStr);
	}
}

// Return items in array #1 but not in array #2
function arrayDiff(ary1, ary2) {
	let diffAry = [];
	for (let i = 0; i < ary1.length; i++) {
		if (ary2.indexOf(ary1[i]) == -1) {
			diffAry.push(ary1[i]);
		}
	}
	return diffAry;
}

// Make AJAX call to submit events
function asyncRequest(method, res, resId, body, callback) {
	// Need more details before we can do an ADD agent
	if (method == 'POST' && typeof(body) === 'undefined') {
		return addAgentDialog(resId);
	}

	let xmlHttp = new XMLHttpRequest();
	if (typeof(callback) === 'function') {
		xmlHttp.onreadystatechange = function() {
			if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
				callback(xmlHttp.responseText);
			}
			else if (xmlHttp.readyState == 4 && xmlHttp.status == 500) {
				let json = JSON.parse(xmlHttp.responseText);
				let results = xmlHttp.responseText;
				let statusText = xmlHttp.statusText;
				if ("results" in json) {
					results = json["results"];
				}
				if ("status" in json) {
					statusText = json["status"];
				}

				// Append error to terminal
				appendToTerminal(["WEBAPP ERROR (AJAX): code=" + xmlHttp.status + ", statusText=" + statusText + ", results=" + results]);

				// Report issue to console
				reportIssue("WEBAPP ERROR (AJAX): code=" + xmlHttp.status + ", statusText=" + statusText + ", results:");
				reportIssue(results);
			}
		}
	}

	xmlHttp.open(method, "/v"+API_VERSION+"/"+res+"/"+resId, true);
	xmlHttp.send(body);
}

// Default/generic async request callback
function defaultReqCallback(responseText) {}

// Validate form inputs
function validateForm(form) {

	// Make sure JSON fields are well-formed
	let jsonFields = document.getElementsByClassName("json_input");
	for (let i = 0; i < jsonFields.length; i++) {
		try {
			let json = JSON.parse(jsonFields[i].value);
			jsonFields[i].style.backgroundColor = "#fff";
		}
		catch (e) {
			jsonFields[i].focus();
			jsonFields[i].style.backgroundColor = "#f99";
			appendToTerminal(["WEBAPP ERROR (FORM): Malformed JSON detected!"]);
			return false;
		}
	}

	return true;
}

// Wrapper to submit Add Agent form
function submitAddAgentForm(form) {
	// Ensure inputs validate
	if (!validateForm(form)) return;

	// Build POST string and send request (generic/default response handler)
	let data = new FormData(form);
	asyncRequest("POST", "agents", form.uuid.value, data, defaultReqCallback);

	// Cleanup
	toggleVisibility('modal_box');
	resetAddAgentForm();
}

// Modal dialog box to add new agent (more details needed)
function addAgentDialog(uuid) {
	document.getElementById('uuid').value = uuid;
	document.getElementById('uuid_str').innerHTML = "("+uuid+")";
	toggleVisibility('modal_box');
}

// When closing modal dialog, reset form
function resetAddAgentForm() {
	// Overall form reset (puts HTML-input values to defaults)
	document.getElementById('add_agent').reset();
	document.getElementById('uuid').value = '';

	// Auto-collapse IMA-related inputs
	document.getElementById('imalist_block').style.display = 'none';
	document.getElementById('policy_block').style.display = 'none';

	// Reset styles for json inputs (in case errors were left)
	let jsonFields = document.getElementsByClassName("json_input");
	for (let i = 0; i < jsonFields.length; i++) {
		jsonFields[i].style.backgroundColor = "#fff";
	}

	// Reset to default tab
	toggleTabs('0');

	// Clear out any uploaded files
	let droppable = document.getElementsByClassName("file_drop");
	for (let i = 0; i < droppable.length; i++) {
		droppable[i].innerHTML = "<i>Drag payload here &hellip;</i>";
		document.getElementById(droppable[i].id + '_data').value = '';
		document.getElementById(droppable[i].id + '_name').value = '';
	}
}

// Toggle visibility of requested agent
function toggleVisibility(eleId) {
	if (document.getElementById(eleId).style.display != 'block') {
		document.getElementById(eleId).style.display = 'block';
	}
	else {
		document.getElementById(eleId).style.display = 'none';
	}
}

// Switch between payload type tabs
function toggleTabs(target) {
	switch (target) {
		case '0': // File upload
			document.getElementById('ca_dir_container').style.display = 'none';
			document.getElementById('keyfile_container').style.display = 'none';
			document.getElementById('file_container').style.display = 'block';
			break;
		case '1': // Key file upload
			document.getElementById('ca_dir_container').style.display = 'none';
			document.getElementById('keyfile_container').style.display = 'block';
			document.getElementById('file_container').style.display = 'block';
			break;
		case '2': // CA dir upload
			document.getElementById('ca_dir_container').style.display = 'block';
			document.getElementById('keyfile_container').style.display = 'none';
			document.getElementById('file_container').style.display = 'none';
			break;
	}
}

// Allow drag-drop of payload file(s) without browser propagation
function dragoverCallback(event) {
	event.stopPropagation();
	event.preventDefault();
	event.dataTransfer.dropEffect = 'copy';
}

// When file dropped onto drop area, prepare as upload
function fileUploadCallback(event) {
	let target = event.target;

	// Bubble up to find the file_drop node
	if (target.classList.contains) {
		while (!target.classList.contains("file_drop")) {
			target = target.parentNode;
		}
	}

	let multi = false;
	if (target.classList.contains("multi_file")) {
		multi = true;
	}

	// Don't let event bubble up any farther
	dragoverCallback(event);

	// Ensure a file was given by user
	let files = event.dataTransfer.files;
	if (files.length == 0) {
		reportIssue("fileUploadCallback: No files provided!");
		return false;
	}

	// Only multi-files can accept multiple files
	if (files.length > 1 && !multi) {
		reportIssue("fileUploadCallback: Attempted to upload multiple files in a single upload box!");
		return false;
	}

	// Clear out old uploads (just in case)
	document.getElementById(target.id + '_data').value = "";
	target.innerHTML = "";

	// Load files from user's computer
	for (let fi in files) {
		let reader = new FileReader();
		reader.onload = function(event) {
			document.getElementById(target.id + '_data').value += reader.result + "\n";
			document.getElementById(target.id + '_name').value += escape(files[fi].name) + "\n";

			let size = files[fi].size;
			let label = 'bytes';
			if (size > 1048576) {
				size = Math.round((size/1048576)*100)/100;
				label = 'MB';
			}
			else if (size > 1024) {
				size = Math.round((size/1024)*100)/100;
				label = 'KB';
			}
			target.innerHTML += '<b>' + escape(files[fi].name) + '</b> <i>' + size + ' ' + label + '</i><br>';
		}
		reader.readAsDataURL(files[fi]);
	}

	return true;
}

// Update agent boxes on page with details
let style_mappings = {
	0 : {"class":"inactive","action":"POST"},
	1 : {"class":"processing","action":"DELETE"},
	2 : {"class":"inactive","action":"PUT"},
	3 : {"class":"processed","action":"DELETE"},
	4 : {"class":"processing","action":"DELETE"},
	5 : {"class":"processed","action":"DELETE"},
	6 : {"class":"processing","action":"DELETE"},
	7 : {"class":"failed","action":"POST"},
	8 : {"class":"inactive","action":"PUT"},
	9 : {"class":"invalid","action":"DELETE"},
	10 : {"class":"invalid","action":"DELETE"},
}
let STR_MAPPINGS = {
	0 : "Registered",
	1 : "Start",
	2 : "Saved",
	3 : "Get Quote",
	4 : "Get Quote (retry)",
	5 : "Provide V",
	6 : "Provide V (retry)",
	7 : "Failed",
	8 : "Terminated",
	9 : "Invalid Quote",
	10: "Tenant Quote Failed"
}
function updateAgentsInfo() {
	let childAgentsObj = document.getElementsByClassName('agent');
	for (let i = 0; i < childAgentsObj.length; i++) {
		if (typeof childAgentsObj[i].id == 'undefined' || childAgentsObj[i].id == '') {
			continue;
		}

		asyncRequest("GET", "agents", childAgentsObj[i].id, undefined, function(responseText){
			let json = JSON.parse(responseText);

			// Ensure response packet isn't malformed
			if (!("results" in json)) {
				reportIssue("ERROR updateAgentsInfo: Malformed response for agent refresh callback!");
				return;
			}
			let response = json["results"];

			// Figure out which agent id we refer to
			if (!("id" in response)) {
				reportIssue("ERROR updateAgentInfo: Cannot determine agent id from callback!");
				return;
			}
			let agentId = response["id"];

			// Format address to display
			let fulladdr = "<i>N/A</i>";
			if ("ip" in response && "port" in response) {
				let ipaddr = response["ip"];
				let port = response["port"];
				fulladdr = ipaddr + ":" + port;
			}

			// Format status to display
			let state = response["operational_state"];
			let statStr = "<i>N/A</i>";
			if ("operational_state" in response) {
				statStr = response["operational_state"];
				let readable = STR_MAPPINGS[statStr];
				statStr = statStr + " (" + readable + ")";
			}

			let agentIdShort = agentId.substr(0,8);
			let classSuffix = style_mappings[state]["class"];
			let action = style_mappings[state]["action"];

			let agentOverviewInsert = ""
					+ "<div onmousedown=\"asyncRequest('" + action + "','agents','" + agentId + "')\" class='tbl_ctrl_" + classSuffix + "'>&nbsp;</div>"
					+ "<div onmousedown=\"toggleVisibility('" + agentId + "-det')\" style='display:block;float:left;'>"
					+ "<div class='tbl_col_" + classSuffix + "' title='" + agentId + "'>" + agentIdShort + "&hellip;</div>"
					+ "<div class='tbl_col_" + classSuffix + "'>" + fulladdr + "</div>"
					+ "<div class='tbl_col_" + classSuffix + "'>" + statStr + "</div>"
					+ "<br style='clear:both;'>"
					+ "</div>"
					+ "<br style='clear:both;'>"

			let agentDetailsInsert = "<div class='tbl_det_" + classSuffix + "'><b><i>Details:</i></b><br><pre>";

			// Parse out detailed specs for agent
			for (let stat in response) {
				statStr = response[stat];

				// Make operational state code more human-readable
				if (stat == "operational_state") {
					let readable = STR_MAPPINGS[statStr];
					statStr = statStr + " (" + readable + ")";
				}
				else if (typeof(statStr) === "object") {
					statStr = JSON.stringify(statStr, null, 2);
				}

				agentDetailsInsert += stat + ": " + statStr + "<br>";
			}
			agentDetailsInsert += "</pre></div>";

			// Update agent on GUI
			document.getElementById(agentId+"-over").innerHTML = agentOverviewInsert;
			document.getElementById(agentId+"-det").innerHTML = agentDetailsInsert;
		});
	}
}

// Populate agents on page (does not handle ordering!)
function populateAgents() {
	asyncRequest("GET", "agents", "", undefined, function(responseText){
		let json = JSON.parse(responseText);

		// Ensure response packet isn't malformed
		if (!("results" in json)) {
			reportIssue("ERROR populateAgents: Malformed response for agent list refresh callback!");
			return;
		}
		let response = json["results"];

		// Figure out which agent id we refer to
		if (!("uuids" in response)) {
			reportIssue("ERROR populateAgents: Cannot get uuid list from callback!");
			return;
		}

		// Get list of agent ids from server
		let agentIds = response["uuids"];
		//console.log(agentIds);

		// Get all existing agent ids
		let childAgentsObj = document.getElementsByClassName('agent');
		let existingAgentIds = [];
		for (let i = 0; i < childAgentsObj.length; i++) {
			if (typeof childAgentsObj[i].id != 'undefined' && childAgentsObj[i].id != '') {
				existingAgentIds.push(childAgentsObj[i].id);
			}
		}
		//console.log(existingAgentIds);

		// Find new agents (in new, not in old)
		let newAgents = arrayDiff(agentIds, existingAgentIds);
		//console.log(newAgents);
		// Find removed agents (in old, not in new)
		let removedAgents = arrayDiff(existingAgentIds, agentIds);
		//console.log(removedAgentss);

		// Add agent
		for (let i = 0; i < newAgents.length; i++) {
			let ele = document.getElementById('agent_template').firstElementChild.cloneNode(true);
			ele.style.display = "block";
			ele.id = newAgents[i];
			ele.firstElementChild.id = newAgents[i] + "-over";
			ele.lastElementChild.id = newAgents[i] + "-det";
			document.getElementById('agent_container').appendChild(ele);
		}

		// Remove agents
		for (let i = 0; i < removedAgents.length; i++) {
			let ele = document.getElementById(removedAgents[i]);
			//console.log(ele);
			ele.parentNode.removeChild(ele);
		}
	});
}

// Tenant log "terminal" window functions: append-to and update (periodic)
function appendToTerminal(logLines) {
	if (typeof(logLines) === 'undefined') {
		return;
	}

	// Get the terminal agent
	let term = document.getElementById('terminal');

	// Keep list at MAX_TERM_LEN items (prune)
	while (term.firstChild && (term.childElementCount+logLines.length) > MAX_TERM_LEN) {
		term.removeChild(term.firstChild);
	}

	// Add each new log line to the terminal
	for (let i = 0; i < logLines.length; i++) {
		gTerminalOffset++; // remember new offset for next request (append logs)
		term.innerHTML += "<div>" + logLines[i] + "</div>";
	}

	// Scroll so newest are in view
	term.scrollTop = term.scrollHeight - term.clientHeight;
}
function updateTerminal() {
	asyncRequest("GET", "logs", "tenant?pos="+gTerminalOffset, undefined, function(responseText){
		let json = JSON.parse(responseText);

		// Ensure response packet isn't malformed
		if (!("results" in json)) {
			reportIssue("ERROR updateTerminal: Malformed response for log refresh callback!");
			return;
		}
		let response = json["results"];

		// Figure out which agent id we refer to
		if (!("log" in response)) {
			reportIssue("ERROR updateTerminal: Cannot get log data from callback!");
			return;
		}

		if (response["log"].length == 0) {
			// nothing new, don't bother!
			return;
		}

		// update terminal display to user
		appendToTerminal(response["log"]);
	});
}

function renderSunburst(data) {
	// render sunburst chart
	let width = 350
	let radius = width / 6
	let arc = d3.arc()
		.startAngle(d => d.x0)
		.endAngle(d => d.x1)
		.padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
		.padRadius(radius * 1.5)
		.innerRadius(d => d.y0 * radius)
		.outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))
	let format = d3.format(",d")

	// colorArray = d3.interpolate("rgb(144, 238, 144)", "rgb(255, 107, 107)", "rgb(211, 211, 211)")
	// console.log(colorArray)
	// color = d3.scaleOrdinal(d3.quantize(colorArray, 3))
	// console.log(color)

	let color = (d) => {
		while (d.depth > 1)
			d = d.parent;
		if (d.data.name == "Registered") {
			return "rgb(111, 111, 111)";
		} else if (d.data.name == "Get Quote") {
			return "rgb(29, 176, 0)";
		} else if (d.data.name == "Invalid Quote") {
			return "rgb(219, 2, 2)";
		} else if (d.data.name == "Start") {
			return "rgb(255, 255, 0)";
		} else {
			return "black";
		}
		}
	let partition = data => {
		const root = d3.hierarchy(data)
			.sum(d => d.value)
			.sort((a, b) => b.value - a.value);
		return d3.partition()
			.size([2 * Math.PI, root.height + 1])
				(root);
	}	

	const root = partition(data);
	root.each(d => d.current = d);

	
	// create an svg
	const svg = d3.select("#sunburst svg")
			.attr("viewBox", [0, 0, width, width])
		.style("font", "10px sans-serif")
		.style("width", "35%")
		.style("height", "35%");


	const g = d3.select("#sunburst svg g")
		.attr("transform", `translate(${width / 2},${width / 2})`);

	const path = d3.select("#path")
		.selectAll("path")
		.data(root.descendants().slice(1))
		.join("path")
			.attr("fill", d => { return color(d); })
			.attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
			.attr("d", d => arc(d.current));

	path.transition().duration(750);
	path.filter(d => d.children)
		.style("cursor", "pointer")
		.on("click", clicked);

	path.append("title")
		.text(d =>{ return `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${(("children" in d) ? d.children.length: d['data']['id'])}`;});

	const label = d3.select("#label")
		.attr("pointer-events", "none")
		.attr("text-anchor", "middle")
		.style("user-select", "none")
		.selectAll("text")
		.data(root.descendants().slice(1))
		.join("text")
		.attr("dy", "0.35em")
		.attr("fill-opacity", d => +labelVisible(d.current))
		.attr("transform", d => labelTransform(d.current))
		.text(d => d.data.name);

	const parent = g.append("circle")
		.datum(root)
		.attr("r", radius)
		.attr("fill", "none")
		.attr("pointer-events", "all")
		.on("click", clicked);

	function clicked(event, p) {
		parent.datum(p.parent || root);

		root.each(d => d.target = {
			x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
			x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
			y0: Math.max(0, d.y0 - p.depth),
			y1: Math.max(0, d.y1 - p.depth)
		});

		const t = g.transition().duration(750);

		// Transition the data on all arcs, even the ones that aren’t visible,
		// so that if this transition is interrupted, entering arcs will start
		// the next transition from the desired position.
		path.transition(t)
			.tween("data", d => {
					const i = d3.interpolate(d.current, d.target);
					return t => d.current = i(t);
			})
				.filter(function(d) {
				return +this.getAttribute("fill-opacity") || arcVisible(d.target);
				})
			.attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
			.attrTween("d", d => () => arc(d.current));

		label.filter(function(d) {
			return +this.getAttribute("fill-opacity") || labelVisible(d.target);
			}).transition(t)
			.attr("fill-opacity", d => +labelVisible(d.target))
			.attrTween("transform", d => () => labelTransform(d.current));
		}

	function arcVisible(d) {
		return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
	}

	function labelVisible(d) {
		return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
	}

	function labelTransform(d) {
		const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
		const y = (d.y0 + d.y1) / 2 * radius;
		return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
	}
}

async function renderCharts() {
	// "/v"+API_VERSION+"/"+res+"/"+resId

	let response = await fetch(`/v${API_VERSION}/agents/`);
	let json = await response.json();
	if (!("results" in json)) {
		reportIssue("ERROR populateAgents: Malformed response for agent list refresh callback!");
		return;
	}
	response = json["results"];

	// Figure out which agent id we refer to
	if (!("uuids" in response)) {
		reportIssue("ERROR populateAgents: Cannot get uuid list from callback!");
		return;
	}

	// Get list of agent ids from server
	let agentIds = response["uuids"];

	console.log(agentIds);

	// status array
	let status_array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	// sunburst chart data
	let data = {
		"name": "agents sunburst chart",
		"children": []
	}
	// initialize status_array
	for (let i = 0; i <= 10; i++) {
		data['children'].push({
			"name": STR_MAPPINGS[i],
			"children": []
		})
	}

	// collect visualization data for pie chart and sunburst chart
	let urls = [];
	for (let i = 0; i < agentIds.length; i++) {
		urls.push(`/v${API_VERSION}/agents/${agentIds[i]}`);
	}
	let requests = urls.map((url) => fetch(url));
	Promise.all(requests)
		.then((responses) => Promise.all(responses.map((res) => res.json())))
		.then((dataItems) => {
			dataItems.forEach((resJson) => {
				let ss = resJson['results']['operational_state'];
				let uuid = resJson['results']['id'];
				status_array[ss]++;
				data['children'][ss]['children'].push({
					id: uuid,
					value: 100,
				});
			});
		})
		.then(() => {
			renderSunburst(data);
			drawChart();
		});
	


	google.charts.load("current", {packages:["corechart"]});
	google.charts.setOnLoadCallback(drawChart);
	function drawChart() {
		var data = google.visualization.arrayToDataTable([
			['Status', 'status'],
			['Registered', status_array[0]],
			['Start', status_array[1]],
			['Saved', status_array[2]],
			['Get Quote', status_array[3]],
			['Get Quote (retry)', status_array[4]],
			['Provide V', status_array[5]],
			['Provide V (retry)', status_array[6]],
			['Failed', status_array[7]],
			['Terminated', status_array[8]],
			['Invalid Quote', status_array[9]],
			['Tenant Quote Failed', status_array[10]]
		]);

		var options = {
			title: 'Agents Status Pie Chart',
			pieHole: 0.4,
			titleTextStyle: {
			fontSize: 25
			},
			colors:['#BEBEBE', '#FFFF00', 'black', '#88FF99', 'black', 'black', 'black', 'black', 'black', '#FF6666', 'black'],
			pieSliceTextStyle: {fontSize: 18},
			legend: {
			textStyle: {
				fontSize: 20
			}
			}
		};
		var chart = new google.visualization.PieChart(document.getElementById('donutchart'));
		function selectHandler() {
			var selectedItem = chart.getSelection()[0];
			if (selectedItem) {
			var topping = data.getValue(selectedItem.row, 0);
			alert('The user selected ' + topping);
			}
		}

		google.visualization.events.addListener(chart, 'select', selectHandler);
		chart.draw(data, options);
	}
}

// Attach dragging capabilities for payload upload functionality
window.onload = function(e) {
	// Add agent drag-drop functionality
	let droppable = document.getElementsByClassName("file_drop");
	for (let i = 0; i < droppable.length; i++) {
		droppable[i].addEventListener('dragover', dragoverCallback, false);
		droppable[i].addEventListener('drop', fileUploadCallback, false);
	}

	// Populate agents on the page (and turn on auto-updates)
	renderCharts();
	setInterval(renderCharts, 20000);
	/*
	populateAgents();
	setInterval(populateAgents, 2000);
	setInterval(updateAgentsInfo, 750);
	setInterval(updateTerminal, 1000);
	*/
}
