/*##################################################|*/
/* #CMS# */
(function($) {
// CMS.$ will be passed for $
$(document).ready(function () {
	/*!
	 * Plugins
	 * for created plugins or generics (static content)
	 */
	CMS.Plugin = new CMS.Class({

		implement: [CMS.API.Helpers],

		options: {
			'type': '', // bar, plugin or generic
			'placeholder_id': null,
			'plugin_type': '',
			'plugin_id': null,
			'plugin_language': '',
			'plugin_parent': null,
			'plugin_order': null,
			'plugin_breadcrumb': [],
			'plugin_restriction': [],
			'urls': {
				'add_plugin': '',
				'edit_plugin': '',
				'move_plugin': '',
				'copy_plugin': ''
			}
		},

		initialize: function (container, options) {
			this.container = $('.' + container);
			this.options = $.extend(true, {}, this.options, options);

			// elements
			this.body = $(document);

			// states
			this.csrf = CMS.config.csrf;
			this.timer = function () {};
			this.timeout = 250;
			this.focused = false;
			this.click = (document.ontouchstart !== null) ? 'click.cms' : 'tap.cms';

			// bind data element to the container
			this.container.data('settings', this.options);

			// determine type of plugin
			switch(this.options.type) {
				case 'placeholder': // handler for placeholder bars
					this._setPlaceholder();
					this._collapsables();
					break;
				case 'plugin': // handler for all plugins
					this._setPlugin();
					this._collapsables();
					break;
				default: // handler for static content
					this._setGeneric();
			}
		},

		// initial methods
		_setPlaceholder: function () {
			var that = this;
			var title = '.cms_dragbar-title';
			var expanded = 'cms_dragbar-title-expanded';
			var dragbar = $('.cms_dragbar-' + this.options.placeholder_id);

			// register the subnav on the placeholder
			this._setSubnav(dragbar.find('.cms_submenu'));

			// enable expanding/collapsing globally within the placeholder
			dragbar.find(title).bind(this.click, function () {
				($(this).hasClass(expanded)) ? that._collapseAll($(this)) : that._expandAll($(this));
			});
		},

		_setPlugin: function () {
			var that = this;
			var timer = function () {};

			// adds double click to edit
			this.container.bind('dblclick', function (e) {
				e.preventDefault();
				e.stopPropagation();
				that.editPlugin(that.options.urls.edit_plugin, that.options.plugin_name, that.options.plugin_breadcrumb);
			});

			// adds edit tooltip
			this.container.bind('mouseover.cms mouseout.cms', function (e) {
				e.stopPropagation();
				var name = that.options.plugin_name;
				var id = that.options.plugin_id;
				(e.type === 'mouseover') ? that.showTooltip(name, id) : that.hideTooltip();
			});

			// adds listener for all plugin updates
			this.container.bind('cms.plugins.update', function (e) {
				e.stopPropagation();
				that.movePlugin();
			});
			// adds listener for copy/paste updates
			this.container.bind('cms.plugin.update', function (e) {
				e.stopPropagation();

				var el = $(e.delegateTarget);
				var dragitem = $('.cms_draggable-' + el.data('settings').plugin_id);
				var placeholder_id = that._getId(dragitem.parents('.cms_draggables').last().prevAll('.cms_dragbar').first());
				var data = el.data('settings');
					data.target = placeholder_id;
					data.parent= that._getId(dragitem.parent().closest('.cms_draggable'));

				that.copyPlugin(data);
			});

			// adds longclick events
			this.container.bind('mousedown mouseup mousemove', function (e) {
				if(e.type !== 'mousemove') e.stopPropagation();
				if(e.type === 'mousedown' && (e.which !== 3 || e.button !== 2)) {
					// start countdown
					timer = setTimeout(function () {
						CMS.API.StructureBoard.setActive(that.options.plugin_id, true);
					}, 500);
				} else {
					clearTimeout(timer);
				}
			});

			// variables for dragitems
			var draggable = $('.cms_draggable-' + this.options.plugin_id);
			var dragitem = draggable.find('> .cms_dragitem');
			var submenu = draggable.find('.cms_submenu:eq(0)');
			var submenus = $('.cms_draggables').find('.cms_submenu');

			// attach event to the plugin menu
			this._setSubnav(draggable.find('> .cms_dragitem .cms_submenu'));

			// adds event for hiding the subnav
			draggable.bind('mouseenter mouseleave mouseover', function (e) {
				e.preventDefault();
				e.stopPropagation();

				if(that.focused) return false;

				if(e.type === 'mouseenter' || e.type === 'mouseover') $(this).data('active', true);
				if(e.type === 'mouseleave') {
					$(this).data('active', false);
					submenus.hide();
				}

				// add timeout to determine if we should hide the element
				setTimeout(function () {
					if(!$(e.currentTarget).data('active')) {
						$(e.currentTarget).find('.cms_submenu:eq(0)').hide();
					}
				}, 100);
			});

			// adds event for showing the subnav
			dragitem.bind('mouseenter', function (e) {
				e.preventDefault();
				e.stopPropagation();

				submenus.hide();
				submenu.show();
			});

			// adds double click to edit
			dragitem.bind('dblclick', function (e) {
				e.preventDefault();
				e.stopPropagation();
				that.editPlugin(that.options.urls.edit_plugin, that.options.plugin_name, that.options.plugin_breadcrumb);
			});

			// adds longclick events
			dragitem.bind('mousedown mouseup mousemove', function (e) {
				if(e.type === 'mousedown') {
					// start countdown
					timer = setTimeout(function () {
						CMS.API.StructureBoard.setActive(that.options.plugin_id, false);
						// prevent dragging
						$(document).bind('mousemove.keypress', function () {
							$(document).trigger('keyup.cms', [true]);
							setTimeout(function () {
								$(document).unbind('mousemove.keypress');
							}, 1000);
						});
					}, 500);
				} else {
					clearTimeout(timer);
				}
			});
		},

		_setGeneric: function () {
			var that = this;

			// adds double click to edit
			this.container.bind('dblclick', function (e) {
				e.preventDefault();
				that.editPlugin(that.options.urls.edit_plugin, that.options.plugin_name, []);
			});

			// adds edit tooltip
			this.container.bind('mouseover.cms mouseout.cms', function (e) {
				e.stopPropagation();
				var name = that.options.plugin_name;
				var id = that.options.plugin_id;
				(e.type === 'mouseover') ? that.showTooltip(name, id) : that.hideTooltip();
			});
		},

		// public methods
		addPlugin: function (type, name, parent) {
			var that = this;
			var data = {
				'placeholder_id': this.options.placeholder_id,
				'plugin_type': type,
				'plugin_parent': parent || '',
				'plugin_language': this.options.plugin_language,
				'csrfmiddlewaretoken': this.csrf
			};

			$.ajax({
				'type': 'POST',
				'url': this.options.urls.add_plugin,
				'data': data,
				'success': function (data) {
					that.editPlugin(data.url, name, data.breadcrumb);
				},
				'error': function (jqXHR) {
					var msg = CMS.config.lang.error;
					// trigger error
					that._showError(msg + jqXHR.status + ' ' + jqXHR.statusText);
				}
			});
		},

		editPlugin: function (url, name, breadcrumb) {
			// trigger modal window
			var modal = new CMS.Modal();
				modal.open(url, name, breadcrumb);
		},

		copyPlugin: function (options) {
			var that = this;
			var move = (options) ? true : false;
			// set correct options
			options = options || this.options;

			var data = {
				'source_placeholder_id': options.placeholder_id,
				'source_plugin_id': options.plugin_id || '',
				'source_language': options.plugin_language,
				'target_plugin_parent': options.parent || '',
				'target_placeholder_id': options.target || CMS.config.clipboard.id,
				'target_language': options.plugin_language,
				'csrfmiddlewaretoken': this.csrf
			};
			var request = {
				'type': 'POST',
				'url': options.urls.copy_plugin,
				'data': data,
				'success': function () {
					CMS.API.Toolbar.openMessage(CMS.config.lang.success);
					// reload
					CMS.API.Helpers.reloadBrowser();
				},
				'error': function (jqXHR) {
					var msg = CMS.config.lang.error;
					// trigger error
					that._showError(msg + jqXHR.status + ' ' + jqXHR.statusText);
				}
			};

			if(move) {
				$.ajax(request);
			} else {
				// ensure clipboard is cleaned
				CMS.API.Clipboard.clear(function () {
					$.ajax(request);
				});
			}
		},

		cutPlugin: function () {
			var that = this;
			var data = {
				'placeholder_id': CMS.config.clipboard.id,
				'plugin_id': this.options.plugin_id,
				'plugin_parent': '',
				'plugin_language': this.options.page_language,
				'plugin_order': [this.options.plugin_id],
				'csrfmiddlewaretoken': this.csrf
			};

			// ensure clipboard is cleaned
			CMS.API.Clipboard.clear(function () {
				// move plugin
				$.ajax({
					'type': 'POST',
					'url': that.options.urls.move_plugin,
					'data': data,
					'success': function (response) {
						CMS.API.Toolbar.openMessage(CMS.config.lang.success);
						// if response is reload
						if(response.reload) CMS.API.Helpers.reloadBrowser();
					},
					'error': function (jqXHR) {
						var msg = CMS.config.lang.error;
						// trigger error
						that._showError(msg + jqXHR.status + ' ' + jqXHR.statusText);
					}
				});
			});
		},

		movePlugin: function (options) {
			var that = this;
			// set correct options
			options = options || this.options;

			var plugin = $('.cms_plugin-' + options.plugin_id);
			var dragitem = $('.cms_draggable-' + options.plugin_id);

			// SETTING POSITION
			// after we insert the plugin onto its new place, we need to figure out whats above it
			var parent_id = this._getId(dragitem.prev('.cms_draggable'));

			if(parent_id) {
				// if we find a previous item, attach it afterwards
				plugin.insertAfter($('.cms_plugin-' + parent_id));
			} else {
				// if we dont find out, we need to figure out where it belongs and get the previous item
				dragitem.parent().parent().next().prepend(plugin);
			}

			// SAVING POSITION
			var placeholder_id = this._getId(dragitem.parents('.cms_draggables').last().prevAll('.cms_dragbar').first());
			var plugin_parent = this._getId(dragitem.parent().closest('.cms_draggable'));
			var plugin_order = this._getIds(dragitem.siblings('.cms_draggable').andSelf());

			// cancel here if we have no placeholder id
			if(placeholder_id === false) return false;

			// gather the data for ajax request
			var data = {
				'placeholder_id': placeholder_id,
				'plugin_id': options.plugin_id,
				'plugin_parent': plugin_parent || '',
				 // this is a hack: when moving to different languages use the global language
				'plugin_language': options.page_language,
				'plugin_order': plugin_order,
				'csrfmiddlewaretoken': this.csrf
			};

			$.ajax({
				'type': 'POST',
				'url': options.urls.move_plugin,
				'data': data,
				'success': function (response) {
					// if response is reload
					if(response.reload) CMS.API.Helpers.reloadBrowser();

					// TODO: show only if(response.status)
					that._showSuccess(dragitem);
				},
				'error': function (jqXHR) {
					var msg = CMS.config.lang.error;
					// trigger error
					that._showError(msg + jqXHR.status + ' ' + jqXHR.statusText);
				}
			});

			// show publish button
			$('.cms_btn-publish').addClass('cms_btn-publish-active').parent().show();
		},

		// private methods
		_setSubnav: function (nav) {
			var that = this;

			nav.bind('mouseenter mouseleave tap.cms', function (e) {
				e.preventDefault();
				e.stopPropagation();
				(e.type === 'mouseenter') ? that._showSubnav($(this)) : that._hideSubnav($(this));
			});

			nav.find('a').bind('click.cms tap.cms', function (e) {
				e.preventDefault();
				e.stopPropagation();

				// show loader and make sure scroll doesn't jump
				CMS.API.Toolbar._loader(true);
				CMS.API.Helpers.preventScroll(false);

				var el = $(this);

				// set switch for subnav entries
				switch(el.attr('data-rel')) {
					case 'add':
						that.addPlugin(el.attr('href').replace('#', ''), el.text(), that._getId(el.closest('.cms_draggable')));
						break;
					case 'edit':
						that.editPlugin(that.options.urls.edit_plugin, that.options.plugin_name, that.options.plugin_breadcrumb);
						break;
					case 'copy':
						that.copyPlugin();
						break;
					case 'cut':
						that.cutPlugin();
						break;
					default:
						CMS.API.Toolbar._loader(false);
						CMS.API.Toolbar._delegate(el);
				}
			});

			nav.find('input').bind('keyup focus blur click', function (e) {
				if(e.type === 'focus') that.focused = true;
				if(e.type === 'blur') {
					that.focused = false;
					that._hideSubnav(nav);
				}
				if(e.type === 'keyup') {
					clearTimeout(that.timer);
					// keybound is not required
					that.timer = setTimeout(function () {
						that._searchSubnav(nav, $(e.currentTarget).val());
					}, 100);
				}
			});

			// set data attributes for original top positioning
			nav.find('.cms_submenu-dropdown').each(function () {
				$(this).data('top', $(this).css('top'))
			});

			// prevent propagnation
			nav.bind(this.click, function (e) {
				e.stopPropagation();
			});
		},

		_showSubnav: function (nav) {
			var that = this;
			var dropdown = nav.find('.cms_submenu-dropdown');
			var offset = parseInt(dropdown.data('top'));

			// clearing
			clearTimeout(this.timer);

			// add small delay before showing submenu
			this.timer = setTimeout(function () {
				// reset z indexes
				var reset = $('.cms_submenu').parentsUntil('.cms_dragarea');
					reset.css('z-index', 0);

				var parents = nav.parentsUntil('.cms_dragarea');
					parents.css('z-index', 999);

				// show subnav
				nav.find('.cms_submenu-quicksearch').show();

				// set visible states
				nav.find('> .cms_submenu-dropdown').show();
			}, 100);

			// add key events
			$(document).unbind('keydown.cms');
			$(document).bind('keydown.cms', function (e) {
				var anchors = nav.find('.cms_submenu-item:visible a');
				var index = anchors.index(anchors.filter(':focus'));

				// bind arrow down and tab keys
				if(e.keyCode === 40 || e.keyCode === 9) {
					e.preventDefault();
					if(index >= 0 && index < anchors.length - 1) {
						anchors.eq(index + 1).focus();
					} else {
						anchors.eq(0).focus();
					}
				}

				// bind arrow up keys
				if(e.keyCode === 38) {
					e.preventDefault();
					if(anchors.is(':focus')) {
						anchors.eq(index - 1).focus();
					} else {
						anchors.eq(anchors.length).focus();
					}
				}

				// hide subnav when hitting enter or escape
				if(e.keyCode === 13 || e.keyCode === 27) {
					nav.find('input').blur();
					that._hideSubnav(nav);
				}
			});

			// calculate subnav bounds
			if($(window).height() + $(window).scrollTop() - nav.offset().top - dropdown.height() <= 10) {
				dropdown.css('top', 'auto');
				dropdown.css('bottom', offset - 1);
			} else {
				dropdown.css('top', offset);
				dropdown.css('bottom', 'auto');
			}

			// enable scroll
			this.preventScroll(true);
		},

		_hideSubnav: function (nav) {
			clearTimeout(this.timer);

			var that = this;
			// cancel if quicksearch is focues
			if(this.focused) return false;

			// set correct active state
			nav.closest('.cms_draggable').data('active', false);

			this.timer = setTimeout(function () {
				// set visible states
				nav.find('> .cms_submenu-dropdown').hide();
				nav.find('.cms_submenu-quicksearch').hide();
				// reset search
				nav.find('input').val('');
				that._searchSubnav(nav, '');
			}, this.timeout);

			// enable scroll
			this.preventScroll(false);

			// reset relativity
			$('.cms_dragbar').css('position', '');
		},

		_searchSubnav: function (nav, value) {
			var items = nav.find('.cms_submenu-item');
			var titles = nav.find('.cms_submenu-item-title');

			// cancel if value is zero
			if(value === '') {
				items.add(titles).show();
				return false;
			}

			// loop through items and figure out if we need to hide items
			items.find('a, span').each(function (index, item) {
				item = $(item);
				var text = item.text().toLowerCase();
				var search = value.toLowerCase();

				(text.indexOf(search) >= 0) ? item.parent().show() : item.parent().hide();
			});

			// check if a title is matching
			titles.filter(':visible').each(function (index, item) {
				titles.hide();
				$(item).nextUntil('.cms_submenu-item-title').show();
			});

			// always display title of a category
			items.filter(':visible').each(function (index, item) {
				if($(item).prev().hasClass('cms_submenu-item-title')) {
					$(item).prev().show();
				} else {
					$(item).prevUntil('.cms_submenu-item-title').last().prev().show();
				}
			});

			// if there is no element visible, show only first categoriy
			nav.find('.cms_submenu-dropdown').show();
			if(items.add(titles).filter(':visible').length <= 0) {
				nav.find('.cms_submenu-dropdown').hide();
			}
		},

		_collapsables: function () {
			var that = this;
			var settings = CMS.API.Toolbar.getSettings();
			var draggable = $('.cms_draggable-' + this.options.plugin_id);

			// check which button should be shown for collapsemenu
			this.container.each(function (index, item) {
				var els = $(item).find('.cms_dragitem-collapsable');
				var open = els.filter('.cms_dragitem-expanded');
				if(els.length === open.length && (els.length + open.length !== 0)) {
					$(item).find('.cms_dragbar-title').addClass('cms_dragbar-title-expanded');
				}
			});
			// cancel here if its not a draggable
			if(!draggable.length) return false;

			// attach events to draggable
			draggable.find('> .cms_dragitem-collapsable').bind(this.click, function () {
				var el = $(this);
				var id = that._getId($(this).parent());

				var settings = CMS.API.Toolbar.getSettings();
					settings.states = settings.states || [];

				// collapsable function and save states
				if(el.hasClass('cms_dragitem-expanded')) {
					settings.states.splice(settings.states.indexOf(id), 1);
					el.removeClass('cms_dragitem-expanded').parent().find('> .cms_draggables').hide();
				} else {
					settings.states.push(id);
					el.addClass('cms_dragitem-expanded').parent().find('> .cms_draggables').show();
				}

				// save settings
				CMS.API.Toolbar.setSettings(settings);
			});
			// adds double click event
			draggable.bind('dblclick', function (e) {
				e.stopPropagation();
				$('.cms_plugin-' + that._getId($(this))).trigger('dblclick');
			});

			// removing dublicate entries
			var sortedArr = settings.states.sort();
			var filteredArray = [];
			for(var i = 0; i < sortedArr.length; i++) {
				if(sortedArr[i] !== sortedArr[i + 1]) {
					filteredArray.push(sortedArr[i]);
				}
			}
			settings.states = filteredArray;

			// loop through the items
			$.each(CMS.API.Toolbar.getSettings().states, function (index, id) {
				var el = $('.cms_draggable-' + id);
					el.find('> .cms_draggables').show();
					el.find('> .cms_dragitem').addClass('cms_dragitem-expanded');
			});
		},

		_expandAll: function (el) {
			var items = el.closest('.cms_dragarea').find('.cms_dragitem-collapsable');
			// cancel if there are no items
			if(!items.length) return false;
			items.each(function () {
				if(!$(this).hasClass('cms_dragitem-expanded')) $(this).trigger('click.cms');
			});

			el.addClass('cms_dragbar-title-expanded');
		},

		_collapseAll: function (el) {
			var items = el.closest('.cms_dragarea').find('.cms_dragitem-collapsable');
			items.each(function () {
				if($(this).hasClass('cms_dragitem-expanded')) $(this).trigger('click.cms');
			});

			el.removeClass('cms_dragbar-title-expanded');
		},

		_getId: function (el) {
			return CMS.API.StructureBoard.getId(el);
		},

		_getIds: function (els) {
			return CMS.API.StructureBoard.getIds(els);
		},

		_showError: function (msg) {
			return CMS.API.Toolbar.showError(msg);
		},

		_showSuccess: function (el) {
			var tpl = $('<div class="cms_dragitem-success"></div>');
			el.append(tpl);
			// start animation
			tpl.fadeOut(function () {
				$(this).remove()
			});
		}

	});

});
})(CMS.$);