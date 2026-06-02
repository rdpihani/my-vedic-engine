// =========================================================================
// वैदिक गणना के कोर फंक्शन्स (Panchang & Lagna Core)
// =========================================================================

const EPOCH_LONGITUDE = { sun: 279.4033, moon: 270.4342 };
const MAX_MANDA_CORRECTION = { sun: 1.915, moon: 5.077 };

function cleanDeg(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
}

function getJulianDate(year, month, day, hour = 12, minute = 0) {
    let y = year;
    let m = month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    let A = Math.floor(y / 100);
    let B = Math.floor(A / 4);
    let C = 2 - A + B;
    let E = Math.floor(365.25 * (y + 4716));
    let F = Math.floor(30.6001 * (m + 1));
    let h = hour + minute / 60.0;
    return C + day + E + F - 1524.5 + (h / 24.0);
}

function getLahiriAyanamsha(jdn) {
    let t = (jdn - 2451545.0) / 36525.0;
    return cleanDeg(23.85 + 0.01396 * t);
}

function calculateTrueVisualSunrise(jdn, lat, lng) {
    let t = (jdn - 2451545.0) / 36525.0;
    let meanSun = cleanDeg(EPOCH_LONGITUDE.sun + (36000.77 * t));
    let trueSunLong = cleanDeg(meanSun - (MAX_MANDA_CORRECTION.sun * Math.sin(meanSun * Math.PI / 180.0)));
    let ayanamsha = getLahiriAyanamsha(jdn);
    let sayanaLong = cleanDeg(trueSunLong + ayanamsha);
    
    let radLat = lat * Math.PI / 180.0;
    let obliquity = 23.439 * Math.PI / 180.0;
    let declination = Math.asin(Math.sin(sayanaLong * Math.PI / 180.0) * Math.sin(obliquity));
    
    let sunriseAlt = -0.833 * Math.PI / 180.0;
    let cosH = (Math.sin(sunriseAlt) - Math.sin(radLat) * Math.sin(declination)) / (Math.cos(radLat) * Math.cos(declination));
    
    if (cosH > 1 || cosH < -1) return 6.0; // Default if extreme lat
    let H = Math.acos(cosH) * 180.0 / Math.PI;
    let sunriseUTC = 12.0 - (H / 15.0) - (lng / 15.0);
    let sunriseLocal = sunriseUTC + 5.5; // IST Offset
    return sunriseLocal < 0 ? sunriseLocal + 24 : (sunriseLocal > 24 ? sunriseLocal - 24 : sunriseLocal);
}

function getVedicData(jdn, lat, lng) {
    let t = (jdn - 2451545.0) / 36525.0;
    let ayanamsha = getLahiriAyanamsha(jdn);
    
    let meanSun = cleanDeg(EPOCH_LONGITUDE.sun + (36000.77 * t));
    let trueSunLong = cleanDeg(meanSun - (MAX_MANDA_CORRECTION.sun * Math.sin(meanSun * Math.PI / 180.0)));
    let nirayanaSun = cleanDeg(trueSunLong - ayanamsha);
    
    let meanMoon = cleanDeg(EPOCH_LONGITUDE.moon + (481267.89 * t));
    let trueMoonLong = cleanDeg(meanMoon + (MAX_MANDA_CORRECTION.moon * Math.sin(meanMoon * Math.PI / 180.0)));
    let nirayanaMoon = cleanDeg(trueMoonLong - ayanamsha);
    
    let tithiVal = cleanDeg(nirayanaMoon - nirayanaSun) / 12.0;
    let tithiNo = Math.floor(tithiVal) + 1;
    let nakshatraNo = Math.floor(nirayanaMoon / (13.3333)) + 1;
    let yogaNo = Math.floor(cleanDeg(nirayanaSun + nirayanaMoon) / (13.3333)) + 1;
    
    const tithiNames = ["प्रथमा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा/अमावस्या"];
    const nakshatraNames = ["अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा", "पूर्वाफाल्गुनी", "उत्तराफाल्गुनी", "हस्त", "चित्रा", "स्वाती", "विशाखा", "अनुराधा", "ज्येष्ठा", "मूल", "पूर्वाषाढ़ा", "उत्तराषाढ़ा", "श्रवण", "धनिष्ठा", "शतभिषा", "पूर्वाभाद्रपद", "उत्तराभाद्रपद", "रेवती"];
    const yogaNames = ["विष्कंभ", "प्रीति", "आयुष्मान", "सौभाग्य", "शोभन", "अतिगंड", "सुकर्मा", "धृति", "शूल", "गंड", "वृद्धि", "ध्रुव", "व्याघात", "हर्षण", "वज्र", "सिद्धि", "व्यतीपात", "वरीयान", "परिख", "शिव", "सिद्ध", "साध्य", "शुभ", "शुक्ल", "ब्रह्म", "ऐन्द्र", "वैधृति"];
    const rashiNames = ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"];
    
    let sunRashi = rashiNames[Math.floor(nirayanaSun / 30)];
    let moonRashi = rashiNames[Math.floor(nirayanaMoon / 30)];
    
    let siderealTime = cleanDeg((280.46061837 + 360.98564736629 * (jdn - 2451545.0) + lng));
    let mc = Math.atan2(Math.sin(siderealTime * Math.PI / 180.0), Math.cos(siderealTime * Math.PI / 180.0) * Math.cos(23.439 * Math.PI / 180.0)) * 180.0 / Math.PI;
    let lagnaDeg = cleanDeg(mc - ayanamsha);
    let lagnaNo = Math.floor(lagnaDeg / 30) + 1;
    let lagnaName = rashiNames[lagnaNo - 1];

    return {
        tithi: tithiNames[(tithiNo - 1) % 15],
        nakshatra: nakshatraNames[(nakshatraNo - 1) % 27],
        yoga: yogaNames[(yogaNo - 1) % 27],
        sunRashi: sunRashi,
        moonRashi: moonRashi,
        lagna: lagnaName
    };
}

// =========================================================================
// शुद्ध एक्सप्रेस सर्वर सेटिंग्स (Pure Express Server)
// =========================================================================
const express = require('express');
const app = express();
app.use(express.json());

// CORS अनुमति ताकि आप इसे किसी भी ऐप या वेबसाइट से कॉल कर सकें
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    next();
});

// मुख्य रास्ता (Root Route) - यह अब हर रिक्वेस्ट को संभालेगा
app.all('/', (req, res) => {
    const data = (req.method === 'POST') ? req.body : req.query;
    
    let year = parseInt(data.year) || new Date().getFullYear();
    let month = parseInt(data.month) || (new Date().getMonth() + 1);
    let day = parseInt(data.day) || new Date().getDate();
    let hour = parseFloat(data.hour) || new Date().getHours();
    let minute = parseFloat(data.minute) || new Date().getMinutes();
    let lat = parseFloat(data.latitude) || 28.6139; // डिफ़ॉल्ट दिल्ली
    let lng = parseFloat(data.longitude) || 77.2090;

    let jdn = getJulianDate(year, month, day, hour, minute);
    let sunrise = calculateTrueVisualSunrise(jdn, lat, lng);
    let vedic = getVedicData(jdn, lat, lng);

    let hrs = Math.floor(sunrise);
    let mins = Math.floor((sunrise - hrs) * 60);
    let sunriseTimeString = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} IST`;

    res.status(200).json({
        status: "success",
        datetime: `${day}-${month}-${year} ${Math.floor(hour)}:${Math.floor(minute)}`,
        coordinates: { latitude: lat, longitude: lng },
        calculations: {
            sunrise: sunriseTimeString,
            tithi: vedic.tithi,
            nakshatra: vedic.nakshatra,
            yoga: vedic.yoga,
            sun_rashi: vedic.sunRashi,
            moon_rashi: vedic.moonRashi,
            lagna: vedic.lagna
        }
    });
});

// रेंडर का पोर्ट बाइंडिंग
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Pure Express Server is listening on port ${port}`);
});
