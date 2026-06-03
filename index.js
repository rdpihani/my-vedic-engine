// =========================================================================
// विशुद्ध_गणक - महा-इंजन (Full Planet & 12 Bhava Sphuta Core)
// =========================================================================

function cleanDeg(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
}

function getJulianDate(year, month, day, hour, minute) {
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    let A = Math.floor(y / 100);
    let B = Math.floor(A / 4);
    let C = 2 - A + B;
    let E = Math.floor(365.25 * (y + 4716));
    let F = Math.floor(30.6001 * (m + 1));
    return C + day + E + F - 1524.5 + ((hour + minute / 60.0) / 24.0);
}

function getLahiriAyanamsha(jdn) {
    let t = (jdn - 2451545.0) / 36525.0;
    return cleanDeg(23.85 + 0.01396 * t);
}

// सरलीकृत खगोलीय ग्रहीय गणना (शुद्ध निरयण मान के लिए)
function getPlanetDegrees(jdn, ayanamsha) {
    let t = (jdn - 2451545.0) / 36525.0;
    
    // ग्रहों के औसत चक्र और गति के आधार पर कोणीय स्थिति
    let sun = cleanDeg(279.4033 + 36000.769 * t) - ayanamsha;
    let moon = cleanDeg(270.4342 + 481267.883 * t) - ayanamsha;
    let mars = cleanDeg(332.2281 + 19140.299 * t) - ayanamsha;
    let mercury = cleanDeg(251.3465 + 149472.515 * t) - ayanamsha;
    let jupiter = cleanDeg(34.3515 + 3034.906 * t) - ayanamsha;
    let venus = cleanDeg(181.2104 + 58517.809 * t) - ayanamsha;
    let saturn = cleanDeg(50.0774 + 1222.114 * t) - ayanamsha;
    let rahu = cleanDeg(125.1228 - 1934.136 * t) - ayanamsha; // वक्री गति
    let ketu = cleanDeg(rahu + 180.0);

    return {
        "सूर्य": cleanDeg(sun), "चंद्रमा": cleanDeg(moon), "मंगल": cleanDeg(mars),
        "बुध": cleanDeg(mercury), "बृहस्पति": cleanDeg(jupiter), "शुक्र": cleanDeg(venus),
        "शनि": cleanDeg(saturn), "राहु": cleanDeg(rahu), "केतु": cleanDeg(ketu)
    };
}

// श्रीपति पद्धति के आधार पर 12 भावों (Houses) का गणित
function getBhavaSpashta(jdn, lat, lng, ayanamsha) {
    let siderealTime = cleanDeg(280.4606 + 360.9856 * (jdn - 2451545.0) + lng);
    let mc = Math.atan2(Math.sin(siderealTime * Math.PI / 180.0), Math.cos(siderealTime * Math.PI / 180.0) * Math.cos(23.439 * Math.PI / 180.0)) * 180.0 / Math.PI;
    let asc = cleanDeg(mc - ayanamsha); // लग्न का उदय बिंदु
    let ic = cleanDeg(asc + 180.0);

    // भावों के कुसप्स (Cusps) का विभाजन
    let bhavaCusps = {};
    for (let i = 1; i <= 12; i++) {
        bhavaCusps[i] = cleanDeg(asc + (i - 1) * 30.0);
    }
    return bhavaCusps;
}

// =========================================================================
// एक्सप्रेस सर्वर कॉन्फ़िगरेशन
// =========================================================================
const express = require('express');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    next();
});

app.all('/', (req, res) => {
    const data = (req.method === 'POST') ? req.body : req.query;
    
    let year = parseInt(data.year) || 2026;
    let month = parseInt(data.month) || 6;
    let day = parseInt(data.day) || 3;
    let hour = parseFloat(data.hour) || 12;
    let minute = parseFloat(data.minute) || 0;
    let lat = parseFloat(data.latitude) || 27.6300; 
    let lng = parseFloat(data.longitude) || 80.2000;

    let jdn = getJulianDate(year, month, day, hour, minute);
    let ayanamsha = getLahiriAyanamsha(jdn);
    let planets = getPlanetDegrees(jdn, ayanamsha);
    let houses = getBhavaSpashta(jdn, lat, lng, ayanamsha);

    res.status(200).json({
        status: "success",
        datetime: `${day}-${month}-${year} ${Math.floor(hour)}:${Math.floor(minute)}`,
        planets: planets,
        houses: houses
    });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Group Quantum Engine running on port ${port}`));
