// Leaflet.HereMutant - use HERE Map JS basemaps in Leaflet.
// See https://github.com/code4history/Leaflet.HereMutant

L.HereMutant = L.Layer.extend({
	options: {
		// 🍂option opacity: Number = 1.0
		// The opacity of the HereMutant
		opacity: 1,

		// 🍂option debugRectangle: Boolean = false
		// Whether to add a rectangle with the bounds of the mutant to the map.
		// Only meant for debugging, most useful at low zoom levels.
		debugRectangle: false,
	},

	initialize: function(options) {
		L.Util.setOptions(this, options);
	},

	onAdd: function(map) {
		this._map = map;

		this._initMutantContainer();

		this._initMutant();

		map.on("move zoom moveend zoomend", this._update, this);
		map.on("resize", this._resize, this);
		this._resize();
	},

	onRemove: function(map) {
		map._container.removeChild(this._mutantContainer);
		this._mutantContainer = undefined;
		map.off("move zoom moveend zoomend", this._update, this);
		map.off("resize", this._resize, this);
		this._mutant.removeEventListener(
			"mapviewchange",
			this._mapviewChangeClosure
		);
		if (this._canvasOverlay) {
			this._canvasOverlay.remove();
		}
	},

	// Create the HTMLElement for the mutant map, and add it as a children
	// of the Leaflet Map container
	_initMutantContainer: function() {
		if (!this._mutantContainer) {
			this._mutantContainer = L.DomUtil.create(
				"div",
				"leaflet-here-mutant leaflet-top leaflet-left"
			);
			this._mutantContainer.id =
				"_MutantContainer_" + L.Util.stamp(this._mutantContainer);
			this._mutantContainer.style.zIndex = "200"; //leaflet map pane at 400, controls at 1000
			this._mutantContainer.style.pointerEvents = "none";

			this._map.getContainer().appendChild(this._mutantContainer);
		}

		this.setElementSize(this._mutantContainer, this._map.getSize());
	},

	// Create the mutant map inside the mutant container
	_initMutant: function() {
		if (!this._mutantContainer) return;

		var platformConfig = {
			apikey: this.options.apikey
		};
		if (this.options.omvBaseUrl) {
			platformConfig.servicesConfig = {
				omv: {
					baseUrl: new H.service.Url(
						this.options.omvBaseUrl[0], this.options.omvBaseUrl[1], this.options.omvBaseUrl[2],{
							apikey: this.options.apikey
						})
				}
			};
		}
		var platform = new H.service.Platform(platformConfig);
		const defaultLayers = platform.createDefaultLayers();
		var map = new H.Map(
			this._mutantContainer,
			defaultLayers.vector.normal.map,
			{}
		);

		this._mutant = map;
		var self = this;
		this._mapviewChangeClosure = function(ev) {
			self._onMapViewChange(ev);
		};
		map.addEventListener("mapviewchange", this._mapviewChangeClosure);

		// 🍂event spawned
		// Fired when the mutant has been created.
		this.fire("spawned", { mapObject: map });

		// Call _update once, so that it can fetch the mutant's canvas and
		// create the L.ImageOverlay
		L.Util.requestAnimFrame(this._update, this);
	},

	// Fetches the map's current *projected* (EPSG:3857) bounds, and returns
	// an instance of H.geo.Rect
	_leafletBoundsToHereRect: function() {
		var bounds = this._map.getBounds();
		return new H.geo.Rect(
			bounds.getNorth(),
			bounds.getWest(),
			bounds.getSouth(),
			bounds.getEast()
		);
	},

	// Given an instance of H.geo.Rect, returns an instance of L.LatLngBounds
	// This depends on the current map center, as to shift the bounds on
	// multiples of 360 in order to prevent artifacts when crossing the
	// antimeridian.
	_hereRectToLeafletBounds: function() {
		var rect = this._mutant
			.getViewModel()
			.getLookAtData()
			.bounds.getBoundingBox();

		var lw = rect.getLeft();
		var le = rect.getRight();

		/*var centerLng = this._map.getCenter().lng;

		// Shift the bounding box on the easting axis so it contains the map center
		if (centerLng < lw) {
			// Shift the whole thing to the west
			var offset = Math.floor((centerLng - lw) / 360) * 360;
			lw += offset;
			le += offset;
		} else if (centerLng > le) {
			// Shift the whole thing to the east
			var offset = Math.ceil((centerLng - le) / 360) * 360;
			lw += offset;
			le += offset;
		}*/

		return L.latLngBounds([
			L.latLng(rect.getTop(), lw),
			L.latLng(rect.getBottom(), le),
		]);
	},

	_update: function() {
		if (this._map && this._mutant) {
			this._mutant.getViewModel().setLookAtData({
				bounds: this._leafletBoundsToHereRect(),
			});
		}
	},

	_resize: function() {
		var size = this._map.getSize();
		if (
			this._mutantContainer.style.width === size.x &&
			this._mutantContainer.style.height === size.y
		)
			return;
		this.setElementSize(this._mutantContainer, size);
		if (!this._mutant) return;
	},

	_onMapViewChange: function(ev) {
		if (!this._mutantCanvas) {
			this._mutantCanvas = this._mutantContainer.querySelector("canvas");
		}

		if (this._map && this._mutantCanvas) {
			// Despite the event name and this method's name, fetch the mutant's
			// visible MapRect, not the mutant's region. It uses projected
			// coordinates (i.e. scaled EPSG:3957 coordinates). This prevents
			// latitude shift artifacts.
			var bounds = this._hereRectToLeafletBounds();

			// The mutant will take one frame to re-stitch its tiles, so
			// repositioning the mutant's overlay has to take place one frame
			// after the 'region-change-end' event, in order to avoid graphical
			// glitching.

			L.Util.cancelAnimFrame(this._requestedFrame);

			this._requestedFrame = L.Util.requestAnimFrame(function() {
				if (!this._canvasOverlay) {
					this._canvasOverlay = L.imageOverlay(null, bounds);

					// Hack the ImageOverlay's _image property so that it doesn't
					// create a HTMLImageElement
					var img = (this._canvasOverlay._image = L.DomUtil.create("div"));

					L.DomUtil.addClass(img, "leaflet-image-layer");
					L.DomUtil.addClass(img, "leaflet-zoom-animated");

					// Move the mutant's canvas out of its container, and into
					// the L.ImageOverlay's _image
					this._mutantCanvas.parentElement.removeChild(this._mutantCanvas);
					img.appendChild(this._mutantCanvas);

					this._canvasOverlay.addTo(this._map);
					this._updateOpacity();
				} else {
					this._canvasOverlay.setBounds(bounds);
				}
				this._mutantCanvas.style.width = "100%";
				this._mutantCanvas.style.height = "100%";
				this._mutantCanvas.style.position = "absolute";

				if (this.options.debugRectangle) {
					if (!this.rectangle) {
						this.rectangle = L.rectangle(bounds, {
							fill: false,
						}).addTo(this._map);
					} else {
						this.rectangle.setBounds(bounds);
					}
				}
			}, this);
		}
	},

	// 🍂method setOpacity(opacity: Number): this
	// Sets the opacity of the HereMutant.
	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	_updateOpacity: function() {
		if (this._mutantCanvas) {
			L.DomUtil.setOpacity(this._mutantCanvas, this.options.opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},
});

L.hereMutant = function hereMutant(options) {
	return new L.HereMutant(options);
};
