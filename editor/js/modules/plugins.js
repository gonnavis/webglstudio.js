 /* This module allows to load external modules on the fly as plugins. */

var PluginsModule = {
	name: "plugins",

	addons_url: "https://www.webglstudio.org/addons/",
	plugins_url: "https://www.webglstudio.org/plugins/",

	preferences_panel: [ { name:"plugins", title:"Plugins", icon:null } ],
	plugins: [], //loaded plugins

	preferences: {
		custom_addons_url: null,
		custom_plugins_url: null,
		plugins: [] //contains objects with info about the plugin,
	},

	init: function()
	{
		var mainmenu = LiteGUI.menubar;
		mainmenu.add("Window/Plugins", { callback: function() { PluginsModule.showPluginsDialog(); }});

		LiteGUI.bind( CORE.root, "plugin_registered", this.onNewPlugin.bind(this) );
		this.loadPlugins();
	},

	loadPlugins: function()
	{
		if(	!this.preferences.plugins || !this.preferences.plugins.length )
			return;

		var plugins = this.preferences.plugins;
		for(var i = 0; i < plugins.length; ++i)
		{
			var info = plugins[i];
			if(info.constructor === String) //legacy
			{
				info = { url: info };
				plugins[i] = info;
			}
			if( info.enabled === undefined ) //legacy
				info.enabled = true;

			if( info.enabled )
				this.loadPlugin( info.url );
		}
	},

	showPluginsDialog: function( on_callback )
	{
		var dialog = new LiteGUI.Dialog( { title: "Plugins", close: true, width: 800, height: 380, scroll: false, draggable: true } );

		var area = new LiteGUI.Area({width:"100%",height:"100%"});
		area.split("horizontal",["50%",null]);
		dialog.add(area);

		var url = PluginsModule.preferences.custom_plugins_url || PluginsModule.plugins_url;
		var selected = null;
		var plugins = this.preferences.plugins;

		var inspector_left = new LiteGUI.Inspector( { scroll: true, resizable: true, full: true } );
		area.getSection(0).add( inspector_left );

		var inspector_right = new LiteGUI.Inspector( { scroll: true, name_width: 150, resizable: true, full: true } );
		area.getSection(1).add( inspector_right );

		inspector_left.addTitle("Plugins");

		var container = inspector_left.startContainer("",{ width: "calc( 100% - 10px )", height: 380});
		container.style.backgroundColor = "black";
		container.style.padding = "5px";
		container.style.overflow = "auto";

		inspector_left.widgets_per_row = 4;
		for(var i = 0; i < plugins.length; ++i)
		{
			var plugin = plugins[i];
			inspector_left.addCheckbox(null, plugin.enabled, { plugin: plugin, width: 60, callback: function(v){ this.options.plugin.enabled = v; }});
			inspector_left.addInfo(null, plugin.name, { width: "calc(100% - 120px)" });
			inspector_left.addButton(null, InterfaceModule.icons.trash, { plugin: plugin, width: 30,
				callback: function(){
					PluginsModule.removePlugin( this.options.plugin );
					PreferencesModule.updateDialogContent();
				}
			});
			inspector_left.addButton(null, InterfaceModule.icons.refresh, { plugin: plugin, width: 30,
				callback: function(){
					var selected = this.options.plugin;
					var plugin = PluginsModule.removePlugin( selected );
					if(!plugin || !plugin.url)
						return;
					PluginsModule.loadPlugin( plugin.url, function(){ PreferencesModule.updateDialogContent(); } );
					PreferencesModule.updateDialogContent();
				}
			});
		}

		inspector_left.endContainer({ width: "100%", height: 380});


		//left
		inspector_left.addString("Repository", url, function(v){
			url = PluginsModule.preferences.custom_plugins_url = v;
		});
		inspector_left.addTitle("Scripts");
		var list = inspector_left.addList(null,[],{ height: 270, callback: function(v){
			selected = v;
			title.setValue(v.name);
			author.setValue(v.author);
			version.setValue(v.version);
			description.setValue(v.description);
		}});
		inspector_left.addSeparator();
		inspector_left.addButton(null,"Refresh",{ callback: function(){
			PluginsModule.fetchList( url, inner );
		}});

		//fetch list
		this.fetchList( url, inner );

		function inner(v)
		{
			if(!v)
				return;
			list.updateItems(v.scripts);
		}

		dialog.show();
	},

	onShowPreferencesPanel: function(name,widgets)
	{
 		if(name != "plugins")
			return;

		var plugins = this.preferences.plugins;

		widgets.addTitle("Plugins");

		var container = widgets.startContainer("",{ width: "calc( 100% - 10px )", height: 380});
		container.style.backgroundColor = "black";
		container.style.padding = "5px";
		container.style.overflow = "auto";

		widgets.widgets_per_row = 4;
		for(var i = 0; i < plugins.length; ++i)
		{
			var plugin = plugins[i];
			widgets.addCheckbox(null, plugin.enabled, { plugin: plugin, width: 60, callback: function(v){ this.options.plugin.enabled = v; }});
			widgets.addInfo(null, plugin.name, { width: "calc(100% - 120px)" });
			widgets.addButton(null, InterfaceModule.icons.trash, { plugin: plugin, width: 30,
				callback: function(){
					PluginsModule.removePlugin( this.options.plugin );
					PreferencesModule.updateDialogContent();
				}
			});
			widgets.addButton(null, InterfaceModule.icons.refresh, { plugin: plugin, width: 30,
				callback: function(){
					var selected = this.options.plugin;
					var plugin = PluginsModule.removePlugin( selected );
					if(!plugin || !plugin.url)
						return;
					PluginsModule.loadPlugin( plugin.url, function(){ PreferencesModule.updateDialogContent(); } );
					PreferencesModule.updateDialogContent();
				}
			});
		}

		widgets.endContainer({ width: "100%", height: 380});

		widgets.widgets_per_row = 1;
		widgets.addStringButton("Add Plugin URL","js/plugins/", { button:"+", callback_button: function(value) { 
			console.log("Loading: " + value);
			PluginsModule.loadPlugin( value, function(){
				PreferencesModule.updateDialogContent();
				PreferencesModule.changeSection("plugins");
			}, function(){
				LiteGUI.alert("Plugin cannot be loaded");
			});
		}});

		widgets.addButton("Fetch from official repository","Search",function(v){
			PluginsModule.showPluginsDialog(function(v){
				
			});
		});
	},

	loadPlugin: function( url, on_complete, on_error )
	{
		var last_plugin = CORE.last_plugin;

		LiteGUI.requireScript( url, inner_loaded, on_error );

		function inner_loaded()
		{
			var plugin = CORE.last_plugin;
			if( last_plugin != plugin )
			{
				//somethign loaded
				console.log( "Plugin loaded: " + plugin.name );
				PluginsModule.registerPlugin( plugin, url );
				if(on_complete)
					on_complete(true);
			}
			else
			{
				var placeholder_plugin = { name: LS.RM.getFilename(url) };
				PluginsModule.registerPlugin( placeholder_plugin, url );
				console.log("Plugin without module?");
				if(on_complete)
					on_complete(false);
			}
		}
	},

	onNewPlugin: function( e )
	{
		//assign preferences
		var plugin = e.detail;
		for(var i in this.preferences.plugins)
		{
			var plugin_info = this.preferences.plugins[i];
			if( plugin_info.url != plugin.url )
				continue;
			
			if(plugin_info.preferences)
				plugin.preferences = plugin_info.preferences;
			break;
		}
	},

	registerPlugin: function( plugin, url )
	{
		plugin.url = url;
		this.plugins.push( plugin ); //register object

		//store in preferences
		var found = null;
		for(var i in this.preferences.plugins)
		{
			var plugin_info = this.preferences.plugins[i];
			if( plugin_info.url != url )
				continue;
			found = plugin_info;
			break;
		}

		if( !found )
			this.preferences.plugins.push( { name: plugin.name, url: url } );
		else
		{
			if( found.preferences )
				plugin.preferences = found.preferences;
		}
		return plugin;
	},

	onPreferencesLoaded: function()
	{
		//store preferences
		for(var i in this.plugins)
		{
			var plugin = this.plugins[i];
			for(var j in this.preferences.plugins)
			{
				var plugin_info = this.preferences.plugins[j];
				if(plugin.url != plugin_info.url )
					continue;
				plugin_info.preferences = plugin.preferences;
			}
		}
	},

	removePlugin: function( name_or_plugin )
	{
		var index = -1;
		var plugin = null;
		if(name_or_plugin.constructor === String)
		{
			for(var i = 0; i < this.plugins.length; ++i)
			{
				var item = this.plugins[i];
				if(item.name != name_or_plugin && item.url != name_or_plugin)
					continue;
				index = i;
				plugin = item;
				break;
			}
		}
		else
		{
			plugin = name_or_plugin;
			index = this.plugins.indexOf( plugin );
		}

		if(!plugin)
		{
			console.warn("Not found: ", name_or_plugin );
			return;
		}

		this.plugins.splice( index,1 );
		this.preferences.plugins.splice( index,1 );

		CORE.removeModule( plugin );
		return plugin;
	},

	reset: function()
	{
		this.plugins = [];
	},

	showAddonsDialog: function( on_callback )
	{
		this.showExternalListDialog("addons", function( url ){
			LS.GlobalScene.external_scripts.push( url );
			LS.GlobalScene.loadScripts( null, on_callback );
		});
	},

	showPluginsDialog: function( on_callback )
	{
		this.showExternalListDialog("plugins", function( url ){
			if( on_callback )
				on_callback( url );
		});
	},

	showExternalListDialog: function( mode, on_callback )
	{
		var dialog = new LiteGUI.Dialog( { title: mode + " Scripts", close: true, width: 800, height: 380, scroll: false, draggable: true } );

		var area = new LiteGUI.Area({width:"100%",height:"100%"});
		area.split("horizontal",["50%",null]);
		dialog.add(area);

		var url;
		if(mode == "plugins")
			url = PluginsModule.preferences.custom_plugins_url || PluginsModule.plugins_url;
		else
			url = PluginsModule.preferences.custom_addons_url || PluginsModule.addons_url;

		var selected = null;

		var inspector_left = new LiteGUI.Inspector( { scroll: true, resizable: true, full: true } );
		area.getSection(0).add( inspector_left );

		var inspector_right = new LiteGUI.Inspector( { scroll: true, name_width: 150, resizable: true, full: true } );
		area.getSection(1).add( inspector_right );

		inspector_right.addTitle("Info");
		inspector_right.startContainer("",{ height: 290 });
		var title = inspector_right.addString("Title","" );
		var author = inspector_right.addString("Author","" );
		var version = inspector_right.addString("Version","" );
		var description = inspector_right.addTextarea("Description","",{height:200} );
		inspector_right.endContainer();
		inspector_right.addSeparator();
		inspector_right.addButton(null,"Include",{ callback: function(){
			if(!selected)
				return;
			var url;
			if(mode == "plugins")
				url = PluginsModule.preferences.custom_plugins_url || PluginsModule.plugins_url;
			else
				url = PluginsModule.preferences.custom_addons_url || PluginsModule.addons_url;
			if(on_callback)
				on_callback( url + selected.script_url );
			EditorModule.refreshAttributes();
			dialog.close();
		}});

		//left
		inspector_left.addString("Repository", url, function(v){
			if(mode == "plugins")
				url = PluginsModule.preferences.custom_plugins_url = v;
			else
				url = PluginsModule.preferences.custom_addons_url = v;
		});
		inspector_left.addTitle("Scripts");
		var list = inspector_left.addList(null,[],{ height: 270, callback: function(v){
			selected = v;
			title.setValue(v.name);
			author.setValue(v.author);
			version.setValue(v.version);
			description.setValue(v.description);
		}});
		inspector_left.addSeparator();
		inspector_left.addButton(null,"Refresh",{ callback: function(){
			PluginsModule.fetchList( url, inner );
		}});

		//fetch list
		this.fetchList( url, inner );

		function inner(v)
		{
			if(!v)
				return;
			list.updateItems(v.scripts);
		}

		dialog.show();
	},

	fetchList: function( url, on_complete )
	{
		LiteGUI.requestJSON( url + "list.json", inner );
		function inner(v)
		{
			if(!v)
				return;
			on_complete(v);
		}
	}
}

CORE.registerModule( PluginsModule );