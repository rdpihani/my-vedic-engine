// index.js (गूगल क्लाउड फंक्शंस के लिए सुरक्षित वैदिक इंजन)
const functions = require('@google-cloud/functions-framework');

const J2000_OFFSET = 2451545.0;
const UJJAIN_LON = 75.7684;
const OBLIQUITY = 23.4392911;
const REFRACTION_OFFSET = 0.56666; 
const SOLAR_TO_SIDEREAL_RATIO = 1.00273790935; 

const DAILY_MOTION = { sun: 0.98564736, moon: 13.17639648, mars: 0.52403295, mercury: 4.09233443, jupiter: 0.08308530, venus: 1.60213022, saturn: 0.03344423, rahu: -0.05295386 };
const EPOCH_LONGITUDE = { sun: 280.4665, moon: 218.3165, mars: 332.2215, mercury: 251.5234, jupiter: 34.3512, venus: 182.0124, saturn: 46.1234, rahu: 125.1234 };
const MANDOCHA = { sun: 77.1233, moon: 130.0333, mars: 130.8422, mercury: 76.9211, jupiter: 171.1233, venus: 80.1244, saturn: 259.1244 };
const MAX_MANDA = { sun: 1.9146, moon: 5.0583, mars: 10.6912, mercury: 5.3411, jupiter: 5.5422, venus: 0.4512, saturn: 6.6923 };
const MAX_SHIGHRA = { mars: 41.21, mercury: 22.31, jupiter: 11.51, venus: 46.31, saturn: 6.21 };

const RASHI_NAMES = ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"];

function cleanDeg(deg) { return (deg % 360.0 + 360.0) % 360.0; }
function rad(deg) { return deg * Math.PI / 180.0; }
function deg(rad) { return rad * 180.0 / Math.PI; }

function calculateAharganaBase(d, m, y, h) {
    if (m <= 2) { y -= 1; m += 12; }
    let A = Math.floor(y / 100); let B = Math.floor(A / 4); let C = 2 - A + B;
    let E = Math.floor(365.25 * (y + 4716)); let F = Math.floor(30.6001 * (m + 1));
    return (C + d + E + F - 1524.5 + (h / 24.0)) - J2000_OFFSET;
}

function getLahiriAyanamsha(ahargana) { return cleanDeg(23.850611 + ((ahargana / 365.256363) * (50.290966 / 3600.0))); }

function calculateTrueVisualSunrise(ahargana, lat, lon) {
    let meanSun = cleanDeg(EPOCH_LONGITUDE.sun + (ahargana * DAILY_MOTION.sun));
    let trueSunLong = cleanDeg(meanSun - (MAX_MANDA.sun * Math.sin(rad(cleanDeg(meanSun - MANDOCHA.sun)))));
    let sayanaSun = cleanDeg(trueSunLong + getLahiriAyanamsha(ahargana));
    let sinKranti = Math.sin(rad(OBLIQUITY)) * Math.sin(rad(sayanaSun));
    let krantiRad = Math.asin(sinKranti);
    let cosH = (-rad(REFRACTION_OFFSET) - (Math.sin(rad(lat)) * Math.sin(krantiRad))) / (Math.cos(rad(lat)) * Math.cos(krantiRad));
    let localHourAngleDeg = deg(Math.acos(Math.max(-1.0, Math.min(1.0, cosH))));
    return { sunriseHour: 12.0 - (localHourAngleDeg / 15.0) - ((lon - UJJAIN_LON) / 15.0), dayLength: (localHourAngleDeg * 2.0) / 15.0, trueSun: trueSunLong, meanSun: meanSun };
}

function applyMandaSanskar(meanLong, planet) {
    if (planet === "rahu" || planet === "ketu") return meanLong;
    return cleanDeg(meanLong - (MAX_MANDA[planet] * Math.sin(rad(cleanDeg(meanLong - MANDOCHA[planet])))));
}

function applyShighraSanskar(mandaLong, planet, ahargana, meanSun) {
    if (!MAX_SHIGHRA[planet]) return mandaLong;
    let shighrocha = ["mercury", "venus"].includes(planet) ? meanSun : cleanDeg(EPOCH_LONGITUDE[planet] + (ahargana * DAILY_MOTION[planet]));
    return cleanDeg(mandaLong + deg(Math.atan2(Math.sin(rad(cleanDeg(shighrocha - mandaLong))), Math.cos(rad(cleanDeg(shighrocha - mandaLong))) + (360.0 / (MAX_SHIGHRA[planet] * 2 * Math.PI)))));
}

function calculateVargaSlicing(longitude, divisions, vargaName) {
    let baseSign = Math.floor(longitude / 30.0);
    let part = Math.floor((longitude % 30.0) / (30.0 / divisions));
    if (vargaName === "D1") return baseSign;
    if (vargaName === "D2") return (baseSign % 2 === 0) ? (part === 0 ? 4 : 3) : (part === 0 ? 3 : 4);
    if (vargaName === "D3") return (baseSign + (part * 4)) % 12;
    if (vargaName === "D9") return ([0, 8, 4, 0, 8, 4, 0, 8, 4, 0, 8, 4][baseSign] + part) % 12;
    return (baseSign * divisions + part) % 12;
}

// गूगल क्लाउड का मुख्य गेटवे (यह इंटरनेट से आने वाले डेटा को रिसीव करेगा)
functions.http('vedicEngine', (req, res) => {
    // सुरक्षा के लिए CORS पॉलिसी सेट करना ताकि आपका ऐप इसे लोड कर सके
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.status(204).send(''); return; }

    // ऐप से भेजा गया डेटा पढ़ना
    const { day, month, year, lat, lon, time_type, hours, minutes, seconds, ghati, pal, vipal } = req.body;

    let finalSolarHours = 0;
    if (time_type === 'modern') {
        finalSolarHours = (parseFloat(hours) || 0) + ((parseFloat(minutes) || 0) / 60.0) + ((parseFloat(seconds) || 0) / 3600.0);
    } else {
        finalSolarHours = ((parseFloat(ghati) || 0) * 0.4) + ((parseFloat(pal) || 0) * 0.00666667) + ((parseFloat(vipal) || 0) * 0.00011111);
    }

    let baseAhargana = calculateAharganaBase(parseInt(day), parseInt(month), parseInt(year), 6.0); 
    let sunMetrics = calculateTrueVisualSunrise(baseAhargana, parseFloat(lat), parseFloat(lon));
    let absoluteAhargana = calculateAharganaBase(parseInt(day), parseInt(month), parseInt(year), sunMetrics.sunriseHour + finalSolarHours);
    
    sunMetrics = calculateTrueVisualSunrise(absoluteAhargana, parseFloat(lat), parseFloat(lon));
    let absoluteTimeHour = sunMetrics.sunriseHour + finalSolarHours;
    absoluteAhargana = calculateAharganaBase(parseInt(day), parseInt(month), parseInt(year), absoluteTimeHour);

    let ayan = getLahiriAyanamsha(absoluteAhargana);
    let lst = (absoluteAhargana * 0.06570982) + absoluteTimeHour + ((parseFloat(lon) - UJJAIN_LON) * 4.0 / 60.0) + 6.6460656;
    let lstDeg = cleanDeg((lst % 24.0) * 15.0);
    
    let absoluteLagna = cleanDeg(deg(Math.atan2(-Math.cos(rad(lstDeg)), (Math.sin(rad(OBLIQUITY)) * Math.tan(rad(parseFloat(lat)))) + (Math.cos(rad(OBLIQUITY)) * Math.sin(rad(lstDeg))))) - ayan);

    let truePositions = { sun: sunMetrics.trueSun, moon: applyMandaSanskar(cleanDeg(EPOCH_LONGITUDE.moon + (absoluteAhargana * DAILY_MOTION.moon)), "moon") };
    ["mars", "mercury", "jupiter", "venus", "saturn"].forEach(p => {
        truePositions[p] = applyShighraSanskar(applyMandaSanskar(cleanDeg(EPOCH_LONGITUDE[p] + (absoluteAhargana * DAILY_MOTION[p])), p), p, absoluteAhargana, sunMetrics.meanSun);
    });
    truePositions["rahu"] = cleanDeg(EPOCH_LONGITUDE.rahu + (absoluteAhargana * DAILY_MOTION.rahu));
    truePositions["ketu"] = cleanDeg(truePositions["rahu"] + 180.0);

    let dist = cleanDeg(truePositions.moon - truePositions.sun);
    let panchang = { tithi: Math.ceil(dist / 12.0) || 30, nakshatra: Math.ceil(truePositions.moon / 13.333333) || 27, yoga: Math.ceil(cleanDeg(truePositions.sun + truePositions.moon) / 13.333333) || 27, kran: Math.ceil(dist / 6.0) || 60 };

    let planetary_results = {};
    for (let p in truePositions) {
        let sIdx = Math.floor(truePositions[p] / 30);
        planetary_results[p] = `${RASHI_NAMES[sIdx]} (${(truePositions[p] % 30).toFixed(2)}°)`;
    }

    let varga_results = {};
    ["D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12", "D16"].forEach(v => {
        varga_results[v] = RASHI_NAMES[calculateVargaSlicing(absoluteLagna, parseInt(v.replace("D","")) || 1, v)];
    });

    // सिर्फ तैयार डेटा (नतीजे) वापस भेजना, कोडिंग पीछे छिप जाएगी
    res.status(200).json({
        sunrise: sunMetrics.sunriseHour.toFixed(2),
        lagna: RASHI_NAMES[Math.floor(absoluteLagna / 30)] + ` (${(absoluteLagna % 30).toFixed(2)}°)`,
        panchang: panchang,
        planets: planetary_results,
        vargas: varga_results
    });
});
