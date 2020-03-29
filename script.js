let rotationDelay = 4000;
let scaleFactor = 0.9;
let degPerSec = 6;
let angles = {x: -20, y: 40, z: 0};

let colorWater = '#1f2026';
let colorGraticule = '#525254';
let colorLand = '#ee3a4b';
let colorCountry = '#c23140';
let colorCountriesBorder = colorCountry;

let canvas = d3.select('#globe');
let context = canvas.node().getContext('2d');
let water = {type: 'Sphere'};
let projection = d3.geoOrthographic().precision(0.1);
let graticule = d3.geoGraticule10();
let path = d3.geoPath(projection).context(context);
let v0, r0, q0;
let lastTime = d3.now();
let degPerMs = degPerSec / 1000;
let width, height;
let land, countries;
let countryList;
let autorotate, now, diff;
let currentCountry;

let cv_total = $('#cv_total'),
    cv_active = $('#cv_active'),
    cv_critical = $('#cv_critical'),
    cv_deaths = $('#cv_deaths'),
    cv_recovered = $('#cv_recovered'),
    cv_today = $('#cv_today'),
    cv_today_deaths = $('#cv_today_deaths'),
    country_name = $('#country_name'),
    country_details_loader = $('#country_loader');

// load total cases
fetch('https://corona.lmao.ninja/all')
    .then(res => {
        if (res.status !== 200) {
            throw new Error("status != 200");
        }
        return res.json()
    })
    .then(json => {
        $('#cv_tt_total').text(formedNumber(json.cases));
        $('#cv_tt_active').text(formedNumber(json.active));
        $('#cv_tt_deaths').text(formedNumber(json.deaths));
        $('#cv_tt_recovered').text(formedNumber(json.recovered));
    })
    .catch(err => {
        console.error(err);
    });

function countryDetails(country) {

    country = encodeURIComponent(country);
    country_details_loader.css({visibility: 'visible'});

    fetch('https://corona.lmao.ninja/countries/' + country)
        .then(res => {
            if (res.status !== 200) {
                throw new Error("status != 200");
            }
            return res.json()
        })
        .then(json => {
            cv_total.text(formedNumber(json.cases));
            cv_active.text(formedNumber(json.active));
            cv_critical.text(formedNumber(json.critical));
            cv_deaths.text(formedNumber(json.deaths));
            cv_recovered.text(formedNumber(json.recovered));
            cv_today.text(formedNumber(json.todayCases));
            cv_today_deaths.text(formedNumber(json.todayDeaths));
        })
        .catch(err => {
            clearDetails();
            alert('No details for this country!');
        })
        .finally(() => {
            country_details_loader.css({visibility: 'hidden'});
        })
}

function enter(country) {
    country = countryList.find(function (c) {
        return +c.id === +country.id
    });
    let n = String(country.name).trim().toLowerCase() === "israel" ? "Philistine" : country.name;
    country_name.text(n);
    countryDetails(+country.id);
}

function setAngles() {
    let rotation = projection.rotate();
    rotation[0] = angles.y;
    rotation[1] = angles.x;
    rotation[2] = angles.z;
    projection.rotate(rotation)
}

function scale() {
    width = document.documentElement.clientWidth;
    height = document.getElementById('canvas_parent').offsetHeight;
    canvas.attr('width', width).attr('height', height);
    projection
        .scale((scaleFactor * Math.min(width, height)) / 2 + 150)
        .translate([width / 2, height / 2]);
    render()
}

function dragstarted() {
    v0 = versor.cartesian(projection.invert(d3.mouse(this)));
    r0 = projection.rotate();
    q0 = versor(r0);
    autorotate.stop()
}

function dragged() {
    let v1 = versor.cartesian(projection.rotate(r0).invert(d3.mouse(this)));
    let q1 = versor.multiply(q0, versor.delta(v0, v1));
    let r1 = versor.rotation(q1);
    projection.rotate(r1);
    render()
}

function dragended() {
    autorotate.restart(rotate, rotationDelay || 0)
}

function render() {
    context.clearRect(0, 0, width, height);
    fill(water, colorWater);
    stroke(graticule, colorGraticule);
    fill(land, colorLand);
    stroke(countries, colorCountriesBorder);
    if (currentCountry) {
        fill(currentCountry, colorCountry)
    }
}

function fill(obj, color) {
    context.beginPath();
    path(obj);
    context.fillStyle = color;
    context.fill()
}

function stroke(obj, color) {
    context.beginPath();
    path(obj);
    context.strokeStyle = color;
    context.stroke()
}

function rotate(elapsed) {
    now = d3.now();
    diff = now - lastTime;
    if (diff < elapsed) {
        rotation = projection.rotate();
        rotation[0] += diff * degPerMs;
        projection.rotate(rotation);
        render()
    }
    lastTime = now
}

function onClick() {
    let c = getCountry(this);
    if (!c) {
        if (currentCountry) {
            currentCountry = undefined;
            render()
        }
        country_name.text('Click to country to get details.');
        clearDetails();
        return
    }
    if (c === currentCountry) {
        return
    }
    currentCountry = c;
    render();
    enter(c);
}

setAngles();

canvas
    .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
    .on("wheel.zoom", function () {
        var currScale = projection.scale();
        var newScale = currScale - 2 * event.deltaY;
        var currTranslate = projection.translate();
        var coords = projection.invert([event.offsetX, event.offsetY]);
        projection.scale(newScale);
        var newPos = projection(coords);

        projection.translate([currTranslate[0] + (event.offsetX - newPos[0]), currTranslate[1] + (event.offsetY - newPos[1])]);
        canvas.selectAll("path").attr("d", path);
        render()
    })
    .on('click', onClick);

d3.json('https://unpkg.com/world-atlas@1/world/110m.json', function (error, world) {
    if (error) throw error;
    d3.tsv('https://gist.githubusercontent.com/mbostock/4090846/raw/07e73f3c2d21558489604a0bc434b3a5cf41a867/world-country-names.tsv', function (error, res_countries) {
        if (error) throw error;

        land = topojson.feature(world, world.objects.land);
        countries = topojson.feature(world, world.objects.countries);
        countryList = res_countries;

        window.addEventListener('resize', scale);
        scale();
        autorotate = d3.timer(rotate)
    })
});

//
// helpers
//

function getCountry(event) {
    let pos = projection.invert(d3.mouse(event));
    return countries.features.find(function (f) {
        return f.geometry.coordinates.find(function (c1) {
            return polygonContains(c1, pos) || c1.find(function (c2) {
                return polygonContains(c2, pos)
            })
        })
    })
}

function polygonContains(polygon, point) {
    let n = polygon.length;
    let p = polygon[n - 1];
    let x = point[0], y = point[1];
    let x0 = p[0], y0 = p[1];
    let x1, y1;
    let inside = false;
    for (let i = 0; i < n; ++i) {
        p = polygon[i];
        x1 = p[0];
        y1 = p[1];
        if (((y1 > y) !== (y0 > y)) && (x < (x0 - x1) * (y - y1) / (y0 - y1) + x1)) inside = !inside;
        x0 = x1;
        y0 = y1;
    }
    return inside
}

function formedNumber(n) {
    return numeral(n).format('0,0');
}

function clearDetails() {
    cv_total.text('---');
    cv_active.text('---');
    cv_critical.text('---');
    cv_deaths.text('---');
    cv_recovered.text('---');
    cv_today.text('---');
    cv_today_deaths.text('---');
}
