var specEl = document.querySelector("#inputVega");

var getIndexes = function(obj) {
  return Object.keys(obj).reduce(function(a, k) {
    return a.concat(obj[k].map(function(d) { return d.name; }));
  }, []);
};

var vgSel = d3.select(".selectSpec");
vgSel.append("option").text("Custom");
vgSel.selectAll("optgroup")
      .data(Object.keys(VG_SPECS))
     .enter().append("optgroup")
      .attr("label", function(key) { return key; })
     .selectAll("option.spec")
      .data(function(key) { return VG_SPECS[key]; })
     .enter().append("option")
      .text(function(d) { return d.name; });

vgSel.on("change", function() {
  var sel = vgSel.node();
  var idx = sel.selectedIndex;
  var spec = d3.select(sel.options[idx]).datum();
  if (idx > 0) {
    d3.xhr("bower_components/vega-editor/app/spec/vega/" + spec.name + ".json", function(error, response) {
      if (error) {
        return console.error(error);
      }
      specEl.value = response.responseText;
      tryDraw();
    });
  } else {
    specEl.value = "";
  }
});

var svg = d3.select("#graph svg"),
    inner = svg.select("g");

// Set up zoom support
var zoom = d3.behavior.zoom().on("zoom", function() {
      inner.attr("transform", "translate(" + d3.event.translate + ")" +
                                  "scale(" + d3.event.scale + ")");
    });
svg.call(zoom);

// Create and configure the renderer
var render = dagreD3.render();

function tryDraw() {
  g = new dagreD3.graphlib.Graph()
    .setGraph({})
    .setDefaultEdgeLabel(function() { return {}; });

  var spec = JSON.parse(specEl.value);
  vg.parse.spec(spec, function(error, chart) {
    var view = chart({el:"#vis"}).update();
    var model = view.model();
    buildGraph(model, g);

    // Set margins, if not present
    if (!g.graph().hasOwnProperty("marginx") &&
        !g.graph().hasOwnProperty("marginy")) {
      g.graph().marginx = 20;
      g.graph().marginy = 20;
    }

    // render
    render(inner, g);

    inner.selectAll("g.node").on("mouseover", function(v){
        n = g.node(v).data;
        console.log(n);
      })
  });
}

function getNodeType(node) {
  var nodeType = node.constructor.name;
  var nodeGroup = null;

  // Scene Nodes
  if (node instanceof vg.scene.Bounder) {
    nodeType = "Bounder";
    nodeGroup = "scene";
  } else if (node instanceof vg.scene.GroupBuilder) {
    nodeType = "Group Builder";
    nodeGroup = "scene";
  } else if(node instanceof vg.scene.Builder) {
    nodeType = "Builder";
    nodeGroup = "scene";
  } else if (node instanceof vg.scene.Encoder) {
    nodeType = "Encoder";
    nodeGroup = "scene";
  }
  // scale
  else if (node._def) {
    nodeType = "Scale " + node._def.name;
    nodeGroup = "scale";
  }
  // Dataflow Nodes
  else if (node instanceof vg.dataflow.Collector) {
    nodeType = "Collector";
    nodeGroup = "df";
  } else if (node instanceof vg.dataflow.Signal) {
    nodeType = "Signal";
    nodeGroup = "df";
  }
  // Other Nodes
  else if (node._isDatasource == "input") {
    nodeType = "Data Source Input";
  } else if (node._isDatasource == "output") {
    nodeType = "Data Source Output";
  }

  if (nodeType.toLowerCase() in vg.transforms) {
    nodeGroup = "transform";
  }

  return {name: nodeType, group: nodeGroup};
}

function buildGraph(model, graph) {
  var nodes = {};
  var edges = {};

  function visit(node) {
    if (!(node._id in nodes)) {
      nodes[node._id] = node;
    }
    node.listeners().forEach(function(child) {
      var key = node._id + "_" + child._id;
      if (!(key in edges)) {
        edges[key] = [node, child];
      }
      visit(child);
    });
  }

  visit(model.node());

  Object.keys(nodes).forEach(function(id) {
    var node = nodes[id];
    var deps = [];
    ["data", "signals", "fields", "scales"].forEach(function(dep) {
      if (node.dependency(dep).length) {
        deps.push(dep + ": " + node.dependency(dep));
      }
    });

    if (deps.length) {
      deps = ("<br>" + deps.join("<br> "));
    } else {
      deps = "";
    }

    var type = getNodeType(node);
    graph.setNode(node._id, {labelType: 'html', label: "<strong>" + type.name + "</strong> <code>" + node._id + "</code> " + deps, class: type.group, data: node});
  });

  Object.keys(edges).forEach(function(key){
    var edge = edges[key];
    graph.setEdge(edge[0]._id, edge[1]._id, {
      lineInterpolate: "basis"
    });
  });
}