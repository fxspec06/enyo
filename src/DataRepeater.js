require('enyo');

/**
* Contains the declaration for the {@link module:enyo/DataRepeater~DataRepeater} kind.
* @module enyo/DataRepeater
*/

var
	kind = require('./kind'),
	utils = require('./utils');
var
	Control = require('./Control'),
	RepeaterChildSupport = require('./RepeaterChildSupport');

function at (idx) {
	return this[idx];
}

function arrayFilter (record) {
	return record[this.selectionProperty];
}

function modelFilter (record) {
	return record.get(this.selectionProperty);
}

/**
* {@link module:enyo/DataRepeater~DataRepeater} iterates over the items in an {@link module:enyo/Collection~Collection} to
* repeatedly render and synchronize records (instances of {@link module:enyo/Model~Model}) to its
* own children. For any record in the collection, a new child will be rendered in
* the repeater. If the record is destroyed, the child will be destroyed. These
* [controls]{@link module:enyo/Control~Control} will automatically update when properties on the
* underlying records are modified if they have been bound using
* [bindings]{@link module:enyo/Binding~Binding}.
*
* @class DataRepeater
* @extends module:enyo/Control~Control
* @ui
* @public
*/
var DataRepeater = module.exports = kind(
	/** @lends module:enyo/DataRepeater~DataRepeater.prototype */ {

	/**
	* @private
	*/
	name: 'enyo.DataRepeater',

	/**
	* @private
	*/
	kind: Control,

	/**
	* Set this to `true` to enable selection support. Note that selection stores a
	* reference to the [model]{@link module:enyo/Model~Model} that is selected, via the
	* [selected]{@link module:enyo/DataRepeater~DataRepeater#selected} method.
	*
	* @type {Boolean}
	* @default true
	* @public
	*/
	selection: true,

	/**
	* Specifies the type of selection (if enabled), that we want to enable. The possible values
	* are 'single', 'multi', and 'group'. The default is 'single' selection mode, which enables
	* selection and deselection of a single item at a time. The 'multi' selection mode allows
	* multiple children to be selected simultaneously, while the 'group' selection mode allows
	* group-selection behavior such that only one child may be selected at a time and, once a
	* child is selected, it cannot be deselected via user input. The child may still be
	* deselected via the selection API methods.
	*
	* @type {String}
	* @default 'single'
	* @public
	*/
	selectionType: 'single',

	/**
	* Set this to `true` to allow multiple children to be selected simultaneously.
	*
	* @deprecated since version 2.6
	* @type {Boolean}
	* @default false
	* @public
	*/
	multipleSelection: false,

	/**
	* Set this to `true` to allow group-selection behavior such that only one child
	* may be selected at a time and, once a child is selected, it cannot be
	* deselected via user input. The child may still be deselected via the selection
	* API methods. Note that setting this property to `true` will set the
	* [multipleSelection]{@link module:enyo/DataRepeater~DataRepeater#multipleSelection} property to
	* `false`.
	*
	* @deprecated since version 2.6
	* @type {Boolean}
	* @default false
	* @public
	*/
	groupSelection: false,

	/**
	* This class will be applied to the [repeater]{@link module:enyo/DataRepeater~DataRepeater} when
	* [selection]{@link module:enyo/DataRepeater~DataRepeater#selection} is enabled. It will also be
	* applied if [multipleSelection]{@link module:enyo/DataRepeater~DataRepeater#multipleSelection}
	* is `true`.
	*
	* @type {String}
	* @default 'selection-enabled'
	* @public
	*/
	selectionClass: 'selection-enabled',

	/**
	* This class will be applied to the [repeater]{@link module:enyo/DataRepeater~DataRepeater} when
	* [selectionType]{@link module:enyo/DataRepeater~DataRepeater#selectionType} is `multi`.
	* When that is the case, the [selectionClass]{@link module:enyo/DataRepeater~DataRepeater#selectionClass}
	* will also be applied.
	*
	* @type {String}
	* @default 'multiple-selection-enabled'
	* @public
	*/
	multipleSelectionClass: 'multiple-selection-enabled',

	/**
	* In cases where selection should be detected from the state of the
	* [model]{@link module:enyo/Model~Model}, this property should be set to the property on
	* the model that the [repeater]{@link module:enyo/DataRepeater~DataRepeater} should observe for
	* changes. If the model changes, the repeater will reflect the change without
	* having to interact directly with the model. Note that this property must be
	* part of the model's schema, or else its changes will not be detected
	* properly.
	*
	* @type {String}
	* @default ''
	* @public
	*/
	selectionProperty: '',

	/**
	* Set this to a space-delimited string of [events]{@glossary event} or an
	* [array]{@glossary Array} that can trigger the selection of a particular
	* child. To prevent selection entirely, set
	* [selection]{@link module:enyo/DataRepeater~DataRepeater#selection} to `false`.
	*
	* @type {String}
	* @default 'ontap'
	* @public
	*/
	selectionEvents: 'ontap',

	/**
	* Use this [hash]{@glossary Object} to define default [binding]{@link module:enyo/Binding~Binding}
	* properties for **all** children (even children of children) of this
	* [repeater]{@link module:enyo/DataRepeater~DataRepeater}. This can eliminate the need to write the
	* same paths over and over. You may also use any binding macros. Any property
	* defined here will be superseded by the same property if defined for an individual
	* binding.
	*
	* @type {Object}
	* @default null
	* @public
	*/
	childBindingDefaults: null,

	/**
	* @private
	*/
	initComponents: function () {
		this.initContainer();
		var components = this.kindComponents || this.components || [],
			owner = this.getInstanceOwner(),
			props = this.defaultProps? utils.clone(this.defaultProps, true): (this.defaultProps = {});
		// ensure that children know who their binding owner is
		props.bindingTransformOwner = this;
		props.bindingDefaults = this.childBindingDefaults;
		if (components) {
			// if there are multiple components in the components block they will become nested
			// children of the default kind set for the repeater
			if (components.length > 1) {
				props.components = components;
			}
			// if there is only one child, the properties will be the default kind of the repeater
			else {
				utils.mixin(props, components[0]);
			}
			props.repeater = this;
			props.owner = owner;
			props.mixins = props.mixins? props.mixins.concat(this.childMixins): this.childMixins;
		}

		this.defaultProps = props;
	},

	/**
	* @method
	* @private
	*/
	constructor: kind.inherit(function (sup) {
		return function () {
			this._selection = [];
			// we need to initialize our selectionEvents array
			var se = this.selectionEvents;
			this.selectionEvents = (typeof se == 'string'? se.split(' '): se);
			// we need to pre-bind these methods so they can easily be added
			// and removed as listeners later
			var h = this._handlers = utils.clone(this._handlers);
			for (var e in h) {
				h[e] = this.bindSafely(h[e]);
			}
			sup.apply(this, arguments);
		};
	}),

	/**
	* @method
	* @private
	*/
	create: kind.inherit(function (sup) {
		return function () {
			sup.apply(this, arguments);
			this.collectionChanged();
			// Converting deprecated selection properties to our current selection API
			this.selectionType = this.multipleSelection ? (this.groupSelection ? 'group' : 'multi') : this.selectionType;
			this.selectionTypeChanged();
		};
	}),

	/**
	* @private
	*/
	groupSelectionChanged: function () {
		this.set('selectionType', this.groupSelection ? 'group' : 'single');
	},

	/**
	* @private
	*/
	multipleSelectionChanged: function () {
		this.set('selectionType', this.multipleSelection ? 'multi' : 'single');
	},

	/**
	* @private
	*/
	selectionTypeChanged: function (was) {
		// Synchronizing our deprecated properties
		this.groupSelection = this.selectionType == 'group';
		this.multipleSelection = this.selectionType == 'multi';

		if (was == 'multi') {
			if (this._selection.length > 1) {
				this.deselectAll();
			}
		}
		this.selectionChanged();
	},

	/**
	* @private
	*/
	selectionChanged: function () {
		this.addRemoveClass(this.selectionClass, this.selection);
		this.addRemoveClass(this.multipleSelectionClass, this.selectionType == 'multi' && this.selection);
	},

	/**
	* Destroys any existing children in the [repeater]{@link module:enyo/DataRepeater~DataRepeater} and creates all
	* new children based on the current [data]{@link module:enyo/Repeater~Repeater#data}.
	*
	* @public
	*/
	reset: function () {
		// use the facaded dataset because this could be any
		// collection of records
		var dd = this.get('data');
		// destroy the client controls we might already have
		this.destroyClientControls();
		// and now we create new ones for each new record we have
		for (var i=0, r; (r=dd.at(i)); ++i) {
			this.add(r, i);
		}
		this.hasReset = true;
	},
	/**
	* Refreshes each [control]{@link module:enyo/Control~Control} in the dataset.
	*
	* @param {Boolean} immediate - If `true`, refresh will occur immediately; otherwise,
	* it will be queued up as a job.
	* @public
	*/
	refresh: function (immediate) {
		if (!this.hasReset) { return this.reset(); }
		var refresh = this.bindSafely(function () {
			var dd = this.get('data'),
				cc = this.getClientControls();
			for (var i=0, c, d; (d=dd.at(i)); ++i) {
				c = cc[i];
				if (c) {
					c.set('model', d);
				} else {
					this.add(d, i);
				}
			}
			this.prune();
		});

		// refresh is used as the event handler for
		// collection resets so checking for truthy isn't
		// enough. it must be true.
		if(immediate === true) {
			refresh();
		} else {
			this.startJob('refreshing', refresh, 16);
		}
	},

	/**
	* @method
	* @private
	*/
	rendered: kind.inherit(function (sup) {
		return function () {
			var dd;

			sup.apply(this, arguments);

			dd = this.get('data');

			if (dd && dd.length) {
				this.reset();
			}
			this.hasRendered = true;
		};
	}),

	/**
	* Adds a [record]{@link module:enyo/Model~Model} at a particular index.
	*
	* @param {module:enyo/Model~Model} rec - The [record]{@link module:enyo/Model~Model} to add.
	* @param {Number} idx - The index at which the record should be added.
	* @public
	*/
	add: function (rec, idx) {
		var c = this.createComponent({model: rec, index: idx});
		if (this.generated && !this.batching) {
			c.render();
		}
	},

	/**
	* Removes the [record]{@link module:enyo/Model~Model} at a particular index.
	*
	* @param {Number} idx - The index of the [record]{@link module:enyo/Model~Model} to be removed.
	* @public
	*/
	remove: function (idx) {
		var controls = this.getClientControls()
			, control;

		control = controls[idx];

		if (control) control.destroy();
	},

	/**
	* Removes any [controls]{@link module:enyo/Control~Control} that are outside the boundaries of the
	* [data]{@link module:enyo/DataRepeater~DataRepeater#data} [collection]{@link module:enyo/Collection~Collection} for the
	* [repeater]{@link module:enyo/DataRepeater~DataRepeater}.
	*
	* @public
	*/
	prune: function () {
		var g = this.getClientControls(),
			dd = this.get('data'),
			len = (dd ? dd.length: 0),
			x;
		if (g.length > len) {
			x = g.slice(len);
			for (var i=0, c; (c=x[i]); ++i) {
				c.destroy();
			}
		}
	},

	/**
	* Syncs the bindings of all repeater children. Designed for use cases where
	* the repeater's collection is a native JavaScript array with native JavaScript
	* objects as models (as opposed to Enyo Collections and Models). In this case,
	* you can't depend on bindings to update automatically when the underlying data
	* changes, so if you know that there has been a change to the data, you can force
	* an update by sync'ing all of the bindings.
	*
	* This API is to be considered experimental and is subject to change.
	*
	* @public
	*/
	syncChildBindings: function (opts) {
		this.getClientControls().forEach(function (c) {
			c.syncBindings(opts);
		});
	},

	/**
	* @private
	*/
	initContainer: function () {
		var ops = this.get('containerOptions'),
			nom = ops.name || (ops.name = this.containerName);
		this.createChrome([ops]);
		this.discoverControlParent();
		if (nom != this.containerName) {
			this.$[this.containerName] = this.$[nom];
		}
	},

	/**
	* @private
	*/
	handlers: {
		onSelected: 'childSelected',
		onDeselected: 'childDeselected'
	},

	/**
	* @private
	*/
	_handlers: {
		add: 'modelsAdded',
		remove: 'modelsRemoved',
		reset: 'refresh',
		sort: 'refresh',
		filter: 'refresh'
	},

	/**
	* @private
	*/
	componentsChanged: function (p) {
		this.initComponents();
		this.reset();
	},

	/**
	* @private
	*/
	collectionChanged: function (p) {
		var c = this.collection;
		if (typeof c == 'string') {
			c = this.collection = utils.getPath.call(global, c);
		}
		if (c) {
			this.initCollection(c, p);
		}
	},

	/**
	* @private
	*/
	initCollection: function (c, p) {
		var e, filter, isArray = c && c instanceof Array;

		if (c && c.addListener) {
			for (e in this._handlers) {
				c.addListener(e, this._handlers[e]);
			}
		}
		// Decorate native JS array with at() so that we can
		// access members of our dataset consistently, regardless
		// of whether our data is in an array or a Collection
		if (c && !c.at) {
			Object.defineProperty(c, 'at', {value: at, enumerable: false});
		}
		if (p && p.removeListener) {
			for (e in this._handlers) {
				p.removeListener(e, this._handlers[e]);
			}
		}
		if (c && this.selectionProperty) {
			filter = isArray ? arrayFilter : modelFilter;
			this._selection = c.filter(filter, this);
		} else {
			this._selection = [];
		}
	},

	/**
	* @private
	*/
	modelsAdded: function (sender, e, props) {
		if (sender === this.collection) this.refresh();
	},

	/**
	* @private
	*/
	modelsRemoved: function (sender, e, props) {
		if (sender === this.collection) {
			this.deselectRemovedModels(props.models);
			this.refresh();
		}
	},

	/**
	* Deselect removed models from _selected array.
	* After calling it, we can ensure that the removed models aren't currently selected.
	* @param {array} models - The array of models that are removed from collection.
	* @private
	*/
	deselectRemovedModels: function(models) {
		var selected = this._selection,
			orig,
			model,
			idx,
			len = selected && selected.length,
			i = models.length - 1;

		// We have selected models
		if (len) {
			// unfortunately we need to make a copy to preserve what the original was
			// so we can pass it with the notification if any of these are deselected
			orig = selected.slice();

			// we have _selected array to track currently selected models
			// if some removed models are in _selected, we should remove them from _selected
			// clearly we won't need to continue checking if selected does not have any models
			for (; (model = models[i]) && selected.length; --i) {
				idx = selected.indexOf(model);
				if (idx > -1) selected.splice(idx, 1);
			}

			// Some selected models are discovered, so we need to notify
			if (len != selected.length) {
				if (this.selection) {
					if (this.selectionType == 'multi') this.notify('selected', orig, selected);
					else this.notify('selected', orig[0], selected[0] || null);
				}
			}
		}
	},

	/**
	* @private
	*/
	batchingChanged: function (prev, val) {
		if (this.generated && false === val) {
			this.$[this.containerName].render();
			this.refresh(true);
		}
	},

	/**
	* Calls [childForIndex()]{@link module:enyo/DataRepeater~DataRepeater#getChildForIndex}. Leaving for posterity.
	*
	* @param {Number} idx - The index of the child to retrieve.
	* @returns {module:enyo/Control~Control|undefined} The [control]{@link module:enyo/Control~Control} at the specified
	* index, or `undefined` if it could not be found or the index is out of bounds.
	* @public
	*/
	getChildForIndex: function (idx) {
		return this.childForIndex(idx);
	},

	/**
	* Attempts to return the [control]{@link module:enyo/Control~Control} representation at a particular index.
	*
	* @param {Number} idx - The index of the child to retrieve.
	* @returns {module:enyo/Control~Control|undefined} The [control]{@link module:enyo/Control~Control} at the specified
	* index, or `undefined` if it could not be found or the index is out of bounds.
	* @public
	*/
	childForIndex: function (idx) {
		return this.$.container.children[idx];
	},

	/**
	* Returns the index of a child control. This is useful primarily when you have a reference to a Control
	* that is not (or may not be) an immediate child of the repeater, but is instead a sub-child of one of the
	* repeater's immediate children.
	*
	* @param {Control} child - The child (or sub-child) whose index you want to retrieve.
	* @returns {Number} The index of the child, or -1 if the Control is not a child of the repeater.
	* @public
	*/
	indexForChild: function (child) {
		while (child && child.repeater !== this) {
			child = child.parent;
		}
		return child ? child.index : -1;
	},

	/**
	* Retrieves the data associated with the [repeater]{@link module:enyo/DataRepeater~DataRepeater}.
	*
	* @returns {module:enyo/Collection~Collection} The {@link module:enyo/Collection~Collection} that comprises the data.
	* @public
	*/
	data: function () {
		return this.collection;
	},

	/**
	* Consolidates selection logic and allows for deselection of a [model]{@link module:enyo/Model~Model}
	* that has already been removed from the [collection]{@link module:enyo/Collection~Collection}.
	*
	* @private
	*/
	_select: function (idx, model, select) {
		if (!this.selection) {
			return;
		}

		var c = this.getChildForIndex(idx),
			s = this._selection,
			i = utils.indexOf(model, s),
			dd = this.get('data'),
			p = this.selectionProperty;

		if (select) {
			if(i == -1) {
				if(this.selectionType != 'multi') {
					while (s.length) {
						i = dd.indexOf(s.pop());
						this.deselect(i);
					}
				}

				s.push(model);
			}
		} else {
			if(i >= 0) {
				s.splice(i, 1);
			}
		}

		if (c) {
			c.set('selected', select);
		}
		if (p && model) {
			if (typeof model.set === 'function') {
				model.set(p, select);
			}
			else {
				model[p] = select;
				if(c) c.syncBindings({force: true, all: true});
			}
		}
		this.notifyObservers('selected');
	},

	/**
	* Selects the item at the given index.
	*
	* @param {Number} idx - The index of the item to select.
	* @public
	*/
	select: function (idx) {
		var dd = this.get('data');

		this._select(idx, dd.at(idx), true);
	},

	/**
	* Deselects the item at the given index.
	*
	* @param {Number} idx - The index of the item to deselect.
	* @public
	*/
	deselect: function (idx) {
		var dd = this.get('data');

		this._select(idx, dd.at(idx), false);
	},

	/**
	* Determines whether a [model]{@link module:enyo/Model~Model} is currently selected.
	*
	* @param {module:enyo/Model~Model} model - The [model]{@link module:enyo/Model~Model} whose selection status
	* is to be determined.
	* @returns {Boolean} `true` if the given model is selected; otherwise, `false`.
	* @public
	*/
	isSelected: function (model) {
		return !!~utils.indexOf(model, this._selection);
	},

	/**
	* Selects all items (if [selectionType]{@link module:enyo/DataRepeater~DataRepeater#selectionType} is `multi`).
	*
	* @public
	*/
	selectAll: function () {
		var dd = this.get('data');

		if (this.selectionType == 'multi') {
			this.stopNotifications();
			var s = this._selection
				, len = dd ? dd.length: 0;
			s.length = 0;
			for (var i=0; i<len; ++i) {
				this.select(i);
			}
			this.startNotifications();
		}
	},

	/**
	* Deselects all items.
	*
	* @public
	*/
	deselectAll: function () {
		var dd = this.get('data');

		if (this.selection) {
			this.stopNotifications();
			var s = this._selection, m, i;
			while (s.length) {
				m = s.pop();
				i = dd.indexOf(m);
				this.deselect(i);
			}
			this.startNotifications();
		}
	},

	/**
	* A computed property that returns the currently selected [model]{@link module:enyo/Model~Model}
	* (if [selectionType]{@link module:enyo/DataRepeater~DataRepeater#selectionType} is not `multi'`),
	* or an immutable [array]{@glossary Array} of all currently selected models (if
	* `selectionType` is `multi'`).
	*
	* @public
	*/
	selected: function() {
		// to ensure that bindings will clear properly according to their api
		return (this.selectionType == 'multi' ? this._selection : this._selection[0]) || null;
	},

	/**
	* @private
	*/
	dataChanged: function () {
		if (this.get('data') && this.hasRendered) {
			this.reset();
		}
	},

	/**
	* @private
	*/
	computed: [
		{method: 'selected'},
		{method: 'data', path: ['controller', 'collection']}
	],

	/**
	* @private
	*/


	/**
	* @private
	*/
	childMixins: [RepeaterChildSupport],

	/**
	* The name of the container specified in
	* [containerOptions]{@link module:enyo/DataRepeater~DataRepeater#containerOptions}. This may or
	* may not have the same value as
	* [controlParentName]{@link module:enyo/DataRepeater~DataRepeater#controlParentName}.
	*
	* @type {String}
	* @default 'container'
	* @public
	*/
	containerName: 'container',

	/**
	* A [Kind]{@glossary Kind} definition that will be used as the chrome for the container
	*  of the DataRepeater. When specifying a custom definition be sure to include a container
	*  component that has the name specified in
	*  [controlParentName]{@link module:enyo/DataRepeater~DataRepeater#controlParentName}.
	*
	* @type {Object}
	* @default {name: 'container', classes: 'enyo-fill enyo-data-repeater-container'}
	* @public
	*/
	containerOptions: {name: 'container', classes: 'enyo-fill enyo-data-repeater-container'},

	/**
	* See {@link module:enyo/UiComponent~UiComponent#controlParentName}
	* @type {String}
	* @default 'container'
	* @public
	*/
	controlParentName: 'container',

	/**
	* @private
	*/
	batching: false,

	/**
	* @private
	*/
	_selection: null,

	// Accessibility

	/**
	* @private
	*/
	ariaObservers: [
		{path: ['selection', 'multipleSelection'], method: function () {
			this.setAriaAttribute('role', this.selection ? 'listbox' : 'list');
			this.setAriaAttribute('aria-multiselectable', this.selection && this.multipleSelection ? true : null);
		}}
	]
});

/**
* @static
* @private
*/
DataRepeater.concat = function (ctor, props) {
	var p = ctor.prototype || ctor;
	if (props.childMixins) {
		p.childMixins = (p.childMixins? utils.merge(p.childMixins, props.childMixins): props.childMixins.slice());
		delete props.childMixins;
	}
};
