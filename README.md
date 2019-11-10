# Leaflet.HereMutant

A [LeafletJS](http://leafletjs.com/) plugin to use [HERE Map JS](https://developer.here.com/documentation/maps/dev_guide/topics/overview.html) basemaps.

The name comes from [MapkitMutant](https://gitlab.com/IvanSanchez/Leaflet.GridLayer.GoogleMutant). It's catchy, even if MapkitMutant doesn't use DOM mutation observers.

## Usage

Include the HERE Map JS API in your HTML, plus Leaflet:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.3/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.3.3/dist/leaflet.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-core.js" type="text/javascript" charset="utf-8"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-service.js" type="text/javascript" charset="utf-8"></script>
```

Include the HereMutant javascript file:

```html
<script src='https://unpkg.com/leaflet.heremutant@latest/Leaflet.HereMutant.js'></script>
```

Then, you can create an instance of `L.HereMutant` on your JS code:

```javascript
var roads = L.hereMutant({
	// API Key which can be got at 'https://developer.here.com/'
	apikey: 'xxxx'
}).addTo(map);
```

## Legalese

Licensed under MIT. See the LICENSE file for details.

