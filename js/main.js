define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/connect",
  "dojo/_base/array",
  "dojo/_base/fx",
  "dojo/io-query",
  "dojo/fx/easing",
  "dojo/query",
  "dojo/on",
  "dojo/aspect",
  "dojo/dom",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/dom-style",
  "dojo/dom-geometry",
  "dojo/_base/Deferred",
  "dojo/dnd/Manager",
  "dojo/dnd/Source",
  "dojo/dnd/Target",
  "dojo/topic",
  "dijit/registry",
  "dijit/Dialog",
  "dijit/TitlePane",
  "dijit/layout/ContentPane",
  "dijit/form/Button",
  "dijit/popup",
  "dijit/Tooltip",
  "dijit/TooltipDialog",
  "esri/config",
  "esri/domUtils",
  "esri/arcgis/utils",
  "esri/map",
  "esri/IdentityManager",
  "esri/dijit/Popup",
  "esri/dijit/Scalebar",
  "esri/dijit/Legend",
  "apl/UOGroupContent",
  "apl/UOBusyStatus"
], function (declare, lang, connect, array, fx, ioQuery, easing, query, on, aspect, dom, domConstruct, domClass, domStyle, domGeom,
             Deferred, Manager, Source, Target, topic, registry, Dialog, TitlePane, ContentPane, Button, popup, Tooltip, TooltipDialog,
             esriConfig, domUtils, arcgisUtils, Map, IdentityManager, esriPopup, Scalebar, Legend, UOGroupContent, UOBusyStatus) {

  /**
   * URBAN OBSERVATORY COMPARE
   */
  var UOCompareApp = declare([], {

    /**
     * LOCAL CONFIG
     */
    config: {},

    /**
     * CURRENT SELECTION
     */
    currentSelection: {
      noun: "",
      theme: "",
      maps: [],
      cities: [],
      level: null
    },

    /**
     * BUSY STATUS
     */
    busyStatus: null,

    /**
     * EASING ANIMATION TYPE
     */
    uoEasing: easing.linear,

    /**
     * GROUP CONTENT
     *
     * @type {UOGroupContent}
     */
    groupContent: null,

    /**
     * DND CATALOG
     */
    uoCatalog: null,

    /**
     * @param config
     */
    constructor: function (config) {
      lang.mixin(this.config, config);

      // TIMEOUT //
      esriConfig.defaults.io.timeout = 10000;

      // IS APPLICATION BEING DISPLAYED WITH A RIGHT-TO-LEFT LOCALE //
      this.isRTL = (this.config.i18n.direction === "rtl");

      // MAKE SURE CITIES ARE PARSED AS ARRAY OF STRINGS //
      if(!(this.config.cities instanceof Array)) {
        this.config.cities = this.config.cities.split(",")
      }

      // MAKE SURE LEVELS ARE TREATED AS NUMBERS //
      this.config.minLevel = parseInt(config.minLevel, 10);
      this.config.level = parseInt(config.level, 10);
      this.config.maxLevel = parseInt(config.maxLevel, 10);
      //console.info("CONFIG: ", this.config);

      // INIT CURRENT SELECTION //
      this.currentSelection.cities[0] = null;
      this.currentSelection.cities[1] = null;
      this.currentSelection.cities[2] = null;
      this.currentSelection.cities[3] = null;
      this.currentSelection.maps[0] = null;
      this.currentSelection.maps[1] = null;
      this.currentSelection.maps[2] = null;
      this.currentSelection.maps[3] = null;
      this.currentSelection.level = this.config.level;

      // BUSY STATUS //
      this.busyStatus = new UOBusyStatus();
      this.busyStatus.on('status-change', lang.hitch(this, this.busyStatusUpdate));

      // SET ADDTHIS TITLE AND URL //
      addthis_share = {
        title: this.config.i18n.mainPage.socialMediaMessage,
        url: window.location.href
      };

      // PROVIDE INSTANCE CONTEXT TO THESE METHODS //
      this.displaySplashDialog = lang.hitch(this, this.displaySplashDialog);
      this.toggleOptions = lang.hitch(this, this.toggleOptions);
      this.getPaneCount = lang.hitch(this, this.getPaneCount);
      this.newThemeSelected = lang.hitch(this, this.newThemeSelected);
      this.updateBrowserUrl = lang.hitch(this, this.updateBrowserUrl);


      // USE TWO PANES //
      if(this.config.dualPane) {
        domUtils.hide(dom.byId('contentPane3'));
        domStyle.set('contentPane1', 'width', '50%');
        registry.byId('centerContainer').layout();
      }

      // UI TEXT - USE i18n STRINGS //
      dom.byId('themeTitle').innerHTML = this.config.i18n.mainPage.Themes;
      dom.byId('cityTitle').innerHTML = this.config.i18n.mainPage.Cities;
      registry.byId('WorkPane').set('title', this.config.i18n.mainPage.Nouns.Work);
      registry.byId('MovementPane').set('title', this.config.i18n.mainPage.Nouns.Movement);
      registry.byId('PeoplePane').set('title', this.config.i18n.mainPage.Nouns.People);
      registry.byId('PublicPane').set('title', this.config.i18n.mainPage.Nouns.Public);
      registry.byId('SystemsPane').set('title', this.config.i18n.mainPage.Nouns.Systems);

      // CLICK EVENT TO TOGGLE TOP OR LEFT PANES //
      query('#topTitlePane').on('click', lang.hitch(this, this.toggleCityListPane));
      query('#leftTitlePane').on('click', lang.hitch(this, this.toggleThemePane));

      // EVENT TO SCROLL CITY OR THEME LISTS //
      query('.scrollPane').on('mousedown', lang.hitch(this, function (evt) {
        this.onScrollPaneClick(evt);
        this.continousScroll = true;
      }));
      query('.scrollPane').on('mouseup', lang.hitch(this, function (evt) {
        this.continousScroll = false;
      }));

      // UPDATE SCROLL ARROWS WHEN THE WINDOW IS RESIZED //
      aspect.after(registry.byId("mainWindow"), "resize", lang.hitch(this, this.updateScrollArrows), true);

    },

    /**
     * STARTUP
     */
    startup: function () {

      // DISPLAY SPLASH DIALOG //
      this.displaySplashDialog();

      //  CREATE DRAG-N-DROP SOURCE FROM CITY LIST CONTAINER //
      this.uoCatalog = new Source("cityList", {
        copyOnly: true,
        selfAccept: false,
        singular: true,
        generateText: false,
        creator: lang.hitch(this, this.catalogNodeCreator)
      });
      // CREATE DRAG-N-DROP TARGET FROM MAP CONTAINERS //
      query('.compareMap').forEach(lang.hitch(this, function (compareMapNode) {
        var dndTarget = new Target(compareMapNode, {
          accept: ["uoItem"],
          checkAcceptance: lang.hitch(this, this.checkDndAcceptance)
        });
      }));
      // LISTEN TO DND TOPICS //
      topic.subscribe('/dnd/start', lang.hitch(this, this.onDndStart));
      topic.subscribe('/dnd/drop', lang.hitch(this, this.onDndDrop));

      // apl/GroupContent //
      this.groupContent = new UOGroupContent(this.config);
      this.groupContent.buildItemList().then(lang.hitch(this, function () {

        // CREATE UI FOR THEMES //
        var nouns = this.groupContent.getNouns();
        array.forEach(nouns, lang.hitch(this, function (noun) {
          var themes = this.groupContent.getThemesForNoun(noun);
          array.forEach(themes, lang.hitch(this, function (theme) {
            this.addThemeItem(noun, theme);
          }));
        }));

        // CREATE UI FOR CITIES //
        var cityNames = this.groupContent.getCities();
        var cityInfos = array.map(cityNames, lang.hitch(this, function (cityName, cityIndex) {
          return {
            name: cityName,
            index: cityIndex,
            targetMap: ((cityIndex % this.getPaneCount()) + 1 )
          };
        }));
        // INSERT CITY NODES INTO DND CATALOG //
        this.uoCatalog.insertNodes(false, cityInfos);

        // TOGGLE UI //
        this.toggleOptions();

        // PREVENT CLICK ACTION ON FIRST LETTER NODE //
        on(dom.byId("listByFirstLetter"), "click", lang.hitch(this, function (evt) {
          evt.stopPropagation();
        }));

        // FIRST LETTER CLICK //
        query(".firstLetter").on("click", lang.hitch(this, function (evt) {
          evt.stopPropagation();

          var firstLetter = evt.currentTarget.id.split("-")[1];
          var cityNodesWithFirstLetter = query(lang.replace(".cityFirstLetter-{0}", [firstLetter]));
          var firstCityNodesWithFirstLetter = cityNodesWithFirstLetter[0];

          var scrollEnd = firstCityNodesWithFirstLetter.offsetLeft;
          if(this.isRTL) {
            var cityListNode = dom.byId('cityList');
            var cityListNodeBox = domGeom.getContentBox(cityListNode, true);
            var firstCityNodesWithFirstLetterBox = domGeom.getContentBox(firstCityNodesWithFirstLetter, true);
            scrollEnd -= (cityListNodeBox.w - firstCityNodesWithFirstLetterBox.w);
          }

          var scrollNode = dom.byId('cityListPane');
          this.scrollPane(scrollNode, {
            direction: 'scrollLeft',
            scroll: {
              start: scrollNode.scrollLeft,
              end: scrollEnd
            }
          }).then(lang.hitch(this, function () {
            this.updateScrollArrows();
          }));
        }));

        // LOAD INITIAL MAPS //
        setTimeout(lang.hitch(this, this.loadConfig), 500);
      }));

    },

    /**
     * DISPLAY SPLASH DIALOG
     */
    displaySplashDialog: function () {

      var splashNode = domConstruct.create('div');

      var welcomeNode = domConstruct.create('div', {
        style: "margin-bottom:25px;",
        innerHTML: this.config.i18n.mainPage.splashDialog.welcome
      }, splashNode);

      var changeTheme = domConstruct.create('div', {
        style: 'margin-top:10px;',
        innerHTML: this.config.i18n.mainPage.splashDialog.changTheme
      }, splashNode);
      var changeCity = domConstruct.create('div', {
        style: 'margin-top:10px;',
        innerHTML: this.config.i18n.mainPage.splashDialog.changeCity
      }, splashNode);

      var moreInfoNode = domConstruct.create('a', {
        style: 'color:white;',
        innerHTML: this.config.i18n.mainPage.splashDialog.moreInfo,
        target: '_blank',
        href: 'http://www.urbanobservatory.org'
      }, domConstruct.create('div', {
        style: 'margin-top:25px;'
      }, splashNode));

      var buttonNode = domConstruct.create('div', {
        id: "splashOkBtn",
        style: 'text-align:center;margin-top:30px;'
      }, splashNode);

      var okBtn = new Button({
        label: '', //this.config.i18n.mainPage.splashDialog.buttonText,
        iconClass: 'busyButtonIcon',
        disabled: true,
        tabindex: 1,
        onClick: function () {
          splashDialog.hide();
        }
      }, domConstruct.create('div', {}, buttonNode));

      var splashContentPane = new ContentPane({
        className: 'splashContent',
        content: splashNode
      });

      var splashDialog = new Dialog({
        id: "splashDialog",
        closable: false,
        content: splashContentPane
      });
      splashDialog.titleNode.innerHTML = '<img src="images/uo_white_smaller.png" class="uoLogo" alt="" />';
      splashDialog.show();

      var onChangeHandle = this.busyStatus.on('status-change', lang.hitch(this, function (busyStatus) {
        if(busyStatus === this.busyStatus.STATUS_NOTBUSY) {
          onChangeHandle.remove();
          // DISPLAY BUTTON //
          okBtn.set('iconClass', '');
          okBtn.set('label', this.config.i18n.mainPage.splashDialog.buttonText);
          okBtn.set('disabled', false);
        }
      }));
    },

    /**
     * GET PANE COUNT
     *
     * @returns {number}
     */
    getPaneCount: function () {
      return (this.config.dualPane ? 2 : 3);
    },

    /**
     * TOGGLE UI OPTIONS
     */
    toggleOptions: function () {
      this.updateScrollArrows();
      this.toggleCityListPane();
      this.toggleThemePane();
    },


    /**
     * SET INITIAL THEME, CITIES, AND MAP SCALE
     */
    loadConfig: function () {

      var themeNode = dom.byId(lang.replace("themeLabel_{noun}_{theme}", this.config));
      if(themeNode) {
        // ESTABLISH THE DEFAULT THEME //
        this.newThemeSelected(this.config.noun, this.config.theme, true);

        // SET MAP LEVEL //
        this.currentSelection.level = this.config.level;

        setTimeout(lang.hitch(this, function () {
          var configCityNames = this.config.cities.slice(0, this.getPaneCount());
          var themeCityNames = this.groupContent.getCitiesForTheme(this.config.noun, this.config.theme);
          array.forEach(configCityNames, lang.hitch(this, function (cityName, cityIndex) {
            // MAKE SURE CITY HAS THIS THEME //
            var cityHasTheme = (array.indexOf(themeCityNames, cityName) > -1);
            // MAKE SURE CITY IS AVAILABLE //
            var cityNode = dom.byId(lang.replace('compareCity_{0}', [cityName]));
            if(cityHasTheme && cityNode) {
              cityNode.cityInfo.targetMap = (cityIndex + 1);
              this.busyStatus.setMoreBusy();
              setTimeout(lang.hitch(this, function () {
                this.loadCity(cityNode).then(lang.hitch(this, function () {
                  this.busyStatus.setLessBusy();
                }));
              }), (750 * cityIndex));
            } else {
              console.info("City doesn't have theme or city node not present: ", cityName, this.config.theme);
            }
          }));
        }), 750);

      } else {
        this.busyStatus.reset();
        console.warn("Unable to load config: ", this.config);
      }
    },

    /**
     * ADD THEME TO LIST
     *
     * NOTE: WE CURRENTLY HAVE A PRESET LIST OF NOUNS.
     *       IF WE SWITCH TO BUILDING THE UI DYNAMICALLY,
     *       WE'LL LOOSE THE SPECIFIC ORDER OF THE NOUNS...
     *
     * @param noun
     * @param theme
     */
    addThemeItem: function (noun, theme) {

      // NOUN NODE //
      var nounNodeId = "themes_" + noun;
      var nounNode = dom.byId(nounNodeId);
      if(!nounNode) {
        // NOUN PANE //
        var nounPaneId = noun + 'Pane';
        var nounPane = registry.byId(nounPaneId);
        if(!nounPane) {
          var themeListPane = registry.byId('themeListPane');
          // CREATE NOUN PANE //
          nounPane = new TitlePane({
            id: nounPaneId,
            className: 'themePane',
            title: noun,
            open: true
          }, domConstruct.create('div', {}, themeListPane.containerNode));
        }
        // CREATE NOUN NODE //
        nounNode = domConstruct.create('div', { id: nounNodeId }, nounPane.containerNode);
      }

      // THEME NODE //
      var themeNode = domConstruct.create('div', {
        id: lang.replace("themeLabel_{0}_{1}", [noun, theme]),
        className: 'themeItem selectable actionItem',
        innerHTML: theme,
        onclick: lang.partial(this.newThemeSelected, noun, theme, true)
      }, nounNode);
    },

    /**
     * NEW THEME SELECTED
     *
     * @param noun
     * @param theme
     * @param replaceMaps
     */
    newThemeSelected: function (noun, theme, replaceMaps) {

      // IGNORE CLICK EVENT IF APP IS BUSY //
      if(this.busyStatus.isBusy()) {
        return;
      }

      // IGNORE IF THIS IS ALREADY THE CURRENT THEME //
      if(this.currentSelection.theme !== theme) {
        // SET CURRENT THEME AND NOUN //
        this.currentSelection.theme = theme;
        this.currentSelection.noun = noun;

        // UPDATE CURRENT THEME TITLE //
        dom.byId('currentThemeTitle').innerHTML = this.currentSelection.theme;

        // MAKE THIS THEME THE ONLY ONE SELECTED //
        query('.themeItem').removeClass('themeSelected');
        var themeNode = dom.byId(lang.replace("themeLabel_{noun}_{theme}", this.currentSelection));
        domClass.add(themeNode, 'themeSelected');

        // RELOAD THEME FOR ACTIVE CITIES IF THE   //
        // CITY HAS A MAP AVAILABLE FOR THIS THEME //
        var cityNames = this.groupContent.getCitiesForTheme(noun, theme);
        query('.cityNode').forEach(lang.hitch(this, function (node, cityIndex) {

          // DOES THE CITY HAVE THIS THEME AVAILABLE //
          var isAvailable = (array.indexOf(cityNames, node.cityInfo.name) > -1);
          // IS THIS CITY ALREADY LOADED //
          var isLoaded = (array.indexOf(this.currentSelection.cities, node) > -1);
          if(isAvailable) {
            // MAKE THIS CITY NODE SELECTABLE //
            domClass.add(node, 'selectable');
            if(isLoaded && replaceMaps) {
              // LOAD CITY WITH NEW THEME //
              this.busyStatus.setMoreBusy();
              setTimeout(lang.hitch(this, function () {
                this.loadCity(node).then(lang.hitch(this, function () {
                  this.busyStatus.setLessBusy();
                }));
              }), (1000 * node.cityInfo.targetMap));
            }
          } else {
            // MAKE THIS CITY NODE NOT SELECTABLE //
            domClass.remove(node, 'selectable');
            if(isLoaded) {

              // THEME NOT AVAILABLE MESSAGE //
              var mapNodeId = 'map' + node.cityInfo.targetMap;
              query('.themeNotAvailable', mapNodeId).orphan();
              domConstruct.create('div', {
                class: 'themeNotAvailable',
                innerHTML: this.config.i18n.mainPage.themeNotAvailable
              }, mapNodeId);

              // UNLOAD CITY //
              this.unloadCity(node);
            }
          }
        }));
      }
    },

    /**
     * ON DND START
     *
     * @param source
     * @param nodes
     * @param copy
     */
    onDndStart: function (source, nodes, copy) {
      //console.log(source,nodes,copy);
      var cityNode = nodes[0];
      // CANCEL DND IF:                            //
      // 1- CITY IS ALREADY SELECTED               //
      // 2- CITY IS NOT SELECTABLE BECAUSE CURRENT //
      //    THEME IS NOT AVAILABLE FOR THIS CITY   //
      // 3- APP IS BUSY LOADING MAPS               //
      if(domClass.contains(cityNode, 'citySelected') || (!domClass.contains(cityNode, 'selectable')) || this.busyStatus.isBusy()) {
        // CANCEL DND //
        topic.publish('/dnd/cancel');
        Manager.manager().stopDrag();
      }
    },

    /**
     * CATALOG DND NODE CREATOR
     *
     * @param cityInfo
     * @param hint
     * @returns {*}
     */
    catalogNodeCreator: function (cityInfo, hint) {
      //console.log(cityInfo,hint);

      // DND AVATAR //
      if(hint === 'avatar') {
        // AVATAR NODE //
        var avatarNode = domConstruct.create('center', {});
        domConstruct.create('div', {
          innerHTML: lang.replace("{0}: {1}", [cityInfo.name, this.currentSelection.theme]),
          className: 'avatarLabel'
        }, avatarNode);
        // THUMBNAIL //
        var thumbnailUrl = this.groupContent.getThumbnailUrl(cityInfo.name, this.currentSelection.noun, this.currentSelection.theme);
        if(thumbnailUrl) {
          domConstruct.create('img', {
            src: thumbnailUrl,
            className: 'avatarThumbnail'
          }, avatarNode);
        }
        return {
          node: avatarNode
        };

      } else {

        /**
         *  CITY FIRST LETTER
         */
        var firstLetter = cityInfo.name[0];

        /**
         * CITY NODE
         *
         * @type {*}
         */
        var cityNode = domConstruct.create('td', {
          id: lang.replace('compareCity_{name}', cityInfo),
          className: lang.replace("cityNode dojoDndItem actionItem selectable cityFirstLetter-{0}", [firstLetter]),
          innerHTML: cityInfo.name
        });
        cityNode.cityInfo = cityInfo;

        /**
         * CITY NODE CLICK
         *
         * @type {*}
         */
        cityNode.onclick = lang.hitch(this, function () {

          // IGNORE CLICK EVENT IF APP IS BUSY //
          if(this.busyStatus.isBusy()) {
            return;
          }

          if(domClass.contains(cityNode, 'citySelected')) {
            this.unloadCity(cityNode);
          } else {
            if(domClass.contains(cityNode, 'selectable')) {
              this.pickMapPanel(cityNode).then(lang.hitch(this, function (availableMap) {
                cityNode.cityInfo.targetMap = availableMap;
                this.busyStatus.setMoreBusy();
                this.loadCity(cityNode).then(lang.hitch(this, function () {
                  this.busyStatus.setLessBusy();
                }));
              }));
            }
          }
        });

        // CRETE FIRST LETTER LINK IF NOT THERE YET... //
        var firstLetterNodeId = lang.replace("firstLetter-{0}", [firstLetter]);
        var listByFirstLetterNode = dom.byId(firstLetterNodeId);
        if(!listByFirstLetterNode) {
          domConstruct.create("div", {
            id: firstLetterNodeId,
            className: "firstLetter",
            innerHTML: firstLetter
          }, "listByFirstLetter", this.isRTL ? "first" : "last");
        }

        return {
          node: cityNode,
          data: cityInfo,
          type: ['uoItem']
        };
      }
    },

    /**
     * BUSY STATUS UPDATE
     *
     * @param busyStatus
     */
    busyStatusUpdate: function (busyStatus) {
      if(busyStatus === this.busyStatus.STATUS_NOTBUSY) {
        query('.actionItem').removeClass('actionItemBusy');
        this.updateBrowserUrl();
      } else {
        query('.actionItem').addClass('actionItemBusy');
      }
    },

    /**
     * GET AVAILABLE MAP PANE
     *
     * @returns {int|null}
     */
    getAvailableMap: function () {
      var availableMap = null;
      var mapNums = this.config.dualPane ? [2, 1] : [3, 2, 1];
      array.forEach(mapNums, lang.hitch(this, function (mapNum) {
        if(this.currentSelection.maps[mapNum] === null) {
          availableMap = mapNum;
        }
      }));
      return availableMap;
    },

    /**
     * FIND FIRST AVAILABLE MAP PANEL,
     * OR ALLOW USER TO SELECT PANEL IF NONE AVAILABLE
     *
     * @param cityNode
     * @return {*}
     */
    pickMapPanel: function (cityNode) {
      var deferred = new Deferred();

      var availableMap = this.getAvailableMap();
      if(availableMap) {
        deferred.resolve(availableMap);

      } else {
        var mapPickerPane = domConstruct.create('table', {
          className: 'mapPicker'
        });

        var labelRow = domConstruct.create('tr', {}, mapPickerPane);
        domConstruct.create('td', {
          colspan: this.getPaneCount(),
          align: 'center',
          class: 'pickMapPanelLabel',
          innerHTML: this.config.i18n.mainPage.selectMapPanel
        }, labelRow);

        var mapPanelsRow = domConstruct.create('tr', {}, mapPickerPane);
        domConstruct.create('td', {
          className: 'mapOption',
          innerHTML: "1",
          mouseenter: function () {
            domClass.add('map1', 'mapOptionHighlight');
          },
          mouseleave: function () {
            domClass.remove('map1', 'mapOptionHighlight');
          },
          click: function () {
            popup.close(mapPickerDialog);
            deferred.resolve(1);
          }
        }, mapPanelsRow);
        domConstruct.create('td', {
          className: 'mapOption',
          innerHTML: "2",
          mouseenter: function () {
            domClass.add('map2', 'mapOptionHighlight');
          },
          mouseleave: function () {
            domClass.remove('map2', 'mapOptionHighlight');
          },
          click: function () {
            popup.close(mapPickerDialog);
            deferred.resolve(2);
          }
        }, mapPanelsRow);

        if(!this.config.dualPane) {
          domConstruct.create('td', {
            className: 'mapOption',
            innerHTML: "3",
            mouseenter: function () {
              domClass.add('map3', 'mapOptionHighlight');
            },
            mouseleave: function () {
              domClass.remove('map3', 'mapOptionHighlight');
            },
            click: function () {
              popup.close(mapPickerDialog);
              deferred.resolve(3);
            }
          }, mapPanelsRow);
        }

        var thumbnailUrl = this.groupContent.getThumbnailUrl(cityNode.cityInfo.name, this.currentSelection.noun, this.currentSelection.theme);
        if(thumbnailUrl) {
          var thumbnailRow = domConstruct.create('tr', {}, mapPickerPane);
          var thumbnailCell = domConstruct.create('td', {
            colspan: this.getPaneCount(),
            align: 'center'
          }, thumbnailRow);
          domConstruct.create('img', {
            src: thumbnailUrl,
            width: '155px'
          }, thumbnailCell);
        }

        var mapPickerDialog = new TooltipDialog({
          content: mapPickerPane,
          onMouseLeave: lang.hitch(this, function () {
            popup.close(mapPickerDialog);
            deferred.reject();
          })
        });

        popup.open({
          popup: mapPickerDialog,
          orient: ["below-centered", "above-centered"],
          around: cityNode
        });

      }

      return deferred.promise;
    },

    /**
     * UNLOAD CITY
     *
     * @param cityNode
     */
    unloadCity: function (cityNode) {
      var deferred = new Deferred();

      var cityInfo = cityNode.cityInfo;
      var map = this.currentSelection.maps[cityInfo.targetMap];
      if(map != null) {
        this.replaceNodeContent(dom.byId('info' + cityInfo.targetMap), '');

        var mapNodeId = 'map' + cityInfo.targetMap;
        var legendNodeId = 'legend' + cityInfo.targetMap;
        this.displayLegend(dom.byId(legendNodeId), false);

        fx.fadeOut({
          node: map.root,
          duration: 1000,
          easing: this.uoEasing,
          onEnd: lang.hitch(this, function () {
            if(map.scalebar) {
              map.scalebar.destroy();
            }
            map.destroy();
            query('.mapSubNode', mapNodeId).orphan();

            this.currentSelection.maps[cityInfo.targetMap] = null;
            domClass.remove(this.currentSelection.cities[cityInfo.targetMap], 'citySelected');

            deferred.resolve();
          })
        }).play();
      } else {
        deferred.resolve();
      }

      return deferred.promise;
    },

    /**
     * CHECK DND ACCEPTANCE
     *
     * @param source
     * @param nodes
     * @returns {*}
     */
    checkDndAcceptance: function (source, nodes) {
      return domClass.contains(nodes[0], 'selectable');
    },

    /**
     * ON DND DROP
     *
     * @param source
     * @param nodes
     * @param copy
     * @param target
     */
    onDndDrop: function (source, nodes, copy, target) {
      query('.dojoDndItem', target.parent).orphan();
      var mapContainer = registry.byNode(target.node);
      var cityNode = nodes[0];
      cityNode.cityInfo.targetMap = mapContainer.targetMap;
      this.busyStatus.setMoreBusy();
      this.loadCity(cityNode).then(lang.hitch(this, function () {
        this.busyStatus.setLessBusy();
      }));
    },

    /**
     * LOAD CITY
     *
     * @param cityNode
     */
    loadCity: function (cityNode) {
      var deferred = new Deferred();

      var cityInfo = cityNode.cityInfo;
      var mapNodeId = 'map' + cityInfo.targetMap;
      var legendNodeId = 'legend' + cityInfo.targetMap;

      query('.themeNotAvailable', mapNodeId).orphan();

      if(!domClass.contains(cityNode, 'cityLoading')) {
        domClass.add(cityNode, 'cityLoading');
        domClass.add(mapNodeId, 'cityLoading');

        var isSameCity = false;
        var oldCityNode = this.currentSelection.cities[cityInfo.targetMap];
        if(oldCityNode) {
          isSameCity = (oldCityNode.cityInfo.name === cityNode.cityInfo.name);
        }
        var map = this.currentSelection.maps[cityInfo.targetMap];
        var previousExtent = ((map != null) && isSameCity) ? map.extent : null;

        if(map) {
          // HIDE PREVIOUS MAP //
          fx.fadeOut({
            node: map.root,
            duration: 500,
            easing: this.uoEasing
          }).play();
        }

        // UNLOAD THE CITY //
        this.unloadCity(cityNode).then(lang.hitch(this, function () {
          this.currentSelection.cities[cityInfo.targetMap] = cityNode;

          var webmap = this.groupContent.getWebmap(cityInfo.name, this.currentSelection.noun, this.currentSelection.theme);
          if(webmap) {

            // CREATE THE POPUP WINDOW FOR THE MAP //
            var popup = esriPopup({
              popupWindow: false
            }, domConstruct.create("div"));

            // GET MAP CONTAINER //
            var mapContainer = registry.byId(mapNodeId).containerNode;
            // CREATE NODE TO HOLD MAP //
            var mapSubNode = domConstruct.create('div', {
              className: 'mapSubNode',
              style: "width:100%;height:100%;"
            }, mapContainer, 'only');
            // FADE OUT NEW MAP NODE BEFORE WE LOAD THE MAP INTO IT //
            fx.fadeOut({
              node: mapSubNode,
              duration: 500,
              easing: this.uoEasing
            }).play();

            // CREATE THE MAP FROM THE WEBMAP ID //
            arcgisUtils.createMap(webmap.id, mapSubNode, {
              bingmapskey: this.config.bingmapskey,
              mapOptions: {
                infoWindow: popup,
                minZoom: this.config.minLevel,
                zoom: this.currentSelection.level,
                maxZoom: this.config.maxLevel,
                logo: false,
                slider: true,
                sliderStyle: 'small'
              }
            }).then(lang.hitch(this, function (createMapResponse) {
              //console.log("createMapResponse: ",createMapResponse);

              // GET MAP //
              var map = createMapResponse.map;
              this.currentSelection.maps[cityInfo.targetMap] = map;
              var hasLODs = (map.__LOD != null);
              if(!hasLODs) {
                console.warn(this.config.i18n.errors.mapHasNoLODs, webmap);
              } else {
                // ARE MAP LODS VALID ACCORDING TO THE //
                // CONFIGURATION MIN/MAX LEVEL INFORMATION //
                var lods = map.__tileInfo.lods;
                var mapMinLevel = lods[0].level;
                var mapMaxLevel = lods[lods.length - 1].level;
                var minLevelNotOK = (mapMinLevel > this.config.minLevel);
                var maxLevelNotOK = (mapMaxLevel < this.config.maxLevel);
                if(minLevelNotOK || maxLevelNotOK) {
                  var mapTitle = createMapResponse.itemInfo.item.title;
                  console.warn(lang.replace("Possible Map level conflicts for '{0}': map[{1}-{2}] vs config[{3}-{4}]", [mapTitle, mapMinLevel, mapMaxLevel, this.config.minLevel, this.config.maxLevel]));
                }
              }

              // CREATE POPUPS EVENTS IF WEBMAP HAS LAYERS WITH POPUPS ENABLED //
              var hasPopups = this.webmapHasPopups(createMapResponse.itemInfo.itemData.operationalLayers);
              if(hasPopups) {
                var infoNode = dom.byId('info' + cityInfo.targetMap);
                var info = (createMapResponse.itemInfo.item.description || this.config.i18n.mainPage.noDescription);
                this.initializePopupEvents(popup, infoNode, info);
              }

              // SET CITY NODE AS SELECTED //
              domClass.add(cityNode, 'citySelected');
              // DISPLAY CITY NAME AND INFO //
              this.displayCityInfo(cityInfo, createMapResponse.itemInfo);

              // MAP UPDATE EVENTS //
              map.on('update-start', lang.hitch(this, function () {
                map.setMapCursor('wait');
              }));
              map.on('update-end', lang.hitch(this, function () {
                map.setMapCursor('default');
              }));

              // MAP SCALEBAR //
              map.scalebar = new Scalebar({
                map: map,
                attachTo: "top-left",
                scalebarUnit: "dual"
              });

              // MAP LEGEND //
              var legendParentNode = domConstruct.create('div', {
                id: legendNodeId,
                className: 'legendNode',
                click: lang.hitch(this, function () {
                  this.toggleLegend(legendParentNode);
                })
              }, map.root);

              var legendTitleNode = domConstruct.create('span', {
                id: legendNodeId + '.legendLabel',
                innerHTML: this.config.i18n.mainPage.legend
              }, legendParentNode);

              var legendNode = domConstruct.create('div', {}, legendParentNode);

              var legendLayers = arcgisUtils.getLegendLayers(createMapResponse);
              var legendDijit = new Legend({
                map: map,
                layerInfos: legendLayers
              }, legendNode);
              legendDijit.startup();

              this.displayLegend(dom.byId(legendNodeId), false);

              // DISPLAY MAP ONCE IT'S FINISHED UPDATING //
              on.once(map, 'update-end', lang.hitch(this, function () {
                fx.fadeIn({
                  node: mapSubNode,
                  duration: 2500,
                  easing: this.uoEasing,
                  onEnd: lang.hitch(this, function () {
                    domClass.remove(cityNode, 'cityLoading');
                    domClass.remove(mapNodeId, 'cityLoading');
                    deferred.resolve();
                  })
                }).play();
              }));
              // UPDATE MAP BASED ON PREVIOUS EXTENT OF CURRENT ZOOM LEVEL //
              if(previousExtent != null) {
                map.setExtent(previousExtent, false)
              } else {
                map.setLevel(this.currentSelection.level);
              }

              // CONNECT MAP SCALE CHANGE EVENTS //
              if(map.navigationManager.eventModel === 'touch') {
                // TOUCH EVENTS //
                connect.connect(map.navigationManager, "_pinchEnd", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));
                on(map._slider, "ontouchend", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));
              } else {
                // MOUSE EVENTS //
                map.on("dbl-click", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));
                map.on("mouse-wheel", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));
                map.on("mouse-drag-start", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));
                on(map._slider, "mouseup", lang.hitch(this, function (evt) {
                  this.connectExtentChangeEvent(map);
                }));

              }
            }), lang.hitch(this, function (createMapError) {
              console.warn(this.config.i18n.errors.errorCreatingMap, createMapError);
              domClass.remove(cityNode, 'cityLoading');
              domClass.remove(mapNodeId, 'cityLoading');
              deferred.reject(createMapError);
            }));

          } else {
            var cantFindWebmapError = new Error(lang.replace("{0}: Urban.{1}.{2}.{3}", [this.config.i18n.errors.webmap, cityInfo.name, this.currentSelection.noun, this.currentSelection.theme]));
            console.warn(this.config.i18n.errors.cantFindWebmap, cantFindWebmapError);
            domClass.remove(cityNode, 'cityLoading');
            domClass.remove(mapNodeId, 'cityLoading');
            deferred.reject(cantFindWebmapError);
          }
        }));
      } else {
        var alreadyLoadingMapError = new Error(lang.replace("{0}: Urban.{1}.{2}.{3}", [this.config.i18n.errors.webmap, cityInfo.name, this.currentSelection.noun, this.currentSelection.theme]));
        console.warn(this.config.i18n.errors.alreadyLoadingCity, alreadyLoadingMapError);
        domClass.remove(cityNode, 'cityLoading');
        domClass.remove(mapNodeId, 'cityLoading');
        deferred.reject(alreadyLoadingMapError);
      }
      return deferred.promise;
    },

    /**
     * WEBMAP HAS POPUPS
     *
     * @param operationalLayers
     * @returns {*|boolean}
     */
    webmapHasPopups: function (operationalLayers) {
      return array.some(operationalLayers, function (operationalLayer) {
        var opLayer = (operationalLayer.popupInfo != null);
        var opLayerLayers = operationalLayer.layers ? array.some(operationalLayer.layers, function (subLayer) {
          return (subLayer.popupInfo != null);
        }) : false;
        var opLayerFCLayers = operationalLayer.featureCollection ? array.some(operationalLayer.featureCollection.layers, function (fcLayer) {
          return (fcLayer.popupInfo != null);
        }) : false;
        return (opLayer || opLayerLayers || opLayerFCLayers);
      });
    },

    /**
     * POPUP EVENTS
     *
     * @param popup
     * @param infoNode
     * @param info
     */
    initializePopupEvents: function (popup, infoNode, info) {
      popup.on("selection-change", lang.hitch(this, function () {
        var feature = popup.getSelectedFeature();
        if(feature) {
          this.replaceNodeContent(infoNode, feature.getContent());
        } else {
          this.replaceNodeContent(infoNode, info);
        }
      }));
    },

    /**
     * DISPLAY CITY TITLE AND DESCRIPTION
     *
     * @param cityInfo
     * @param itemInfo
     */
    displayCityInfo: function (cityInfo, itemInfo) {

      var titleNode = dom.byId('city' + cityInfo.targetMap);
      var infoNode = dom.byId('info' + cityInfo.targetMap);

      var title = (cityInfo.name || itemInfo.item.title);
      var info = (itemInfo.item.description || this.config.i18n.mainPage.noDescription);

      this.replaceNodeContent(titleNode, title);
      this.replaceNodeContent(infoNode, info);
    },

    /**
     * REPLACE NODE CONTENT USING FADE ANIMATION
     *
     * @param node
     * @param content
     */
    replaceNodeContent: function (node, content) {
      var oldContent = registry.byNode(node).get('content');
      if(oldContent != content) {
        fx.fadeOut({
          node: node,
          duration: 300,
          easing: this.uoEasing,
          onEnd: lang.hitch(this, function () {
            registry.byNode(node).set('content', content);
            fx.fadeIn({
              node: node,
              duration: 2000
            }).play();
          })
        }).play();
      }
    },

    /**
     * CONNECT MAP EVENTS
     *
     * @param map
     */
    connectExtentChangeEvent: function (map) {
      on.once(map, 'extent-change', lang.hitch(this, function (evt) {
        if(evt.levelChange) {
          // LOD LEVEL //
          this.currentSelection.level = evt.lod.level;
          // SYNC OTHER MAPS //
          array.forEach(this.currentSelection.maps, lang.hitch(this, function (otherMap) {
            if(otherMap != null) {
              if((otherMap.id !== map.id) && (otherMap.getLevel() !== this.currentSelection.level)) {
                otherMap.setLevel(this.currentSelection.level);
              }
            }
          }));
          if(!this.busyStatus.isBusy()) {
            // UPDATE BROWSER URL //
            this.updateBrowserUrl();
          }
        }
      }));
    },

    /**
     * SCROLL CITY LIST RIGHT/LEFT OR THEME LIST UP/DOWN
     *
     * @param evt
     */
    onScrollPaneClick: function (evt) {

      var cityListPanePos = domGeom.position(dom.byId('cityListPane'), true);
      var scrollDistance = (cityListPanePos.w * 0.95);
      var scrollNode = null;

      var scrollParentPane = registry.byNode(evt.target);
      switch (scrollParentPane.scrollDir) {
        case 'left':
          scrollNode = dom.byId('cityListPane');
          this.scrollPane(scrollNode, {
            direction: 'scrollLeft',
            scroll: {
              start: scrollNode.scrollLeft,
              end: scrollNode.scrollLeft - (this.isRTL ? -scrollDistance : scrollDistance)
            }
          }).then(lang.hitch(this, function () {
            this.updateScrollArrows();
            if(this.continousScroll) {
              this.onScrollPaneClick(evt);
            }
          }));
          break;

        case 'right':
          scrollNode = dom.byId('cityListPane');
          this.scrollPane(scrollNode, {
            direction: 'scrollLeft',
            scroll: {
              start: scrollNode.scrollLeft,
              end: scrollNode.scrollLeft + (this.isRTL ? -scrollDistance : scrollDistance)
            }
          }).then(lang.hitch(this, function () {
            this.updateScrollArrows();
            if(this.continousScroll) {
              this.onScrollPaneClick(evt);
            }
          }));
          break;

        case 'up':
          scrollNode = dom.byId('themeListPane');
          this.scrollPane(scrollNode, {
            direction: 'scrollTop',
            scroll: {
              start: scrollNode.scrollTop,
              end: scrollNode.scrollTop - scrollDistance
            }
          }).then(lang.hitch(this, function () {
            this.updateScrollArrows();
            if(this.continousScroll) {
              this.onScrollPaneClick(evt);
            }
          }));
          break;

        case 'down':
          scrollNode = dom.byId('themeListPane');
          this.scrollPane(scrollNode, {
            direction: 'scrollTop',
            scroll: {
              start: scrollNode.scrollTop,
              end: scrollNode.scrollTop + scrollDistance
            }
          }).then(lang.hitch(this, function () {
            this.updateScrollArrows();
            if(this.continousScroll) {
              this.onScrollPaneClick(evt);
            }
          }));
          break;
      }
    },

    /**
     *  SHOW/HIDE SCROLL ARROWS
     */
    updateScrollArrows: function () {

      // THEME LIST //
      var themeListPane = dom.byId('themeListPane');
      var systemsPanePos = domGeom.position('SystemsPane', true);
      var scrollDownPanePos = domGeom.position('scrollDownPane', true);
      var atListBottom = ((systemsPanePos.y + systemsPanePos.h) <= scrollDownPanePos.y);
      domClass.toggle(dom.byId('scrollUpPane'), 'disabled', (themeListPane.scrollTop === 0));
      domClass.toggle(dom.byId('scrollDownPane'), 'disabled', atListBottom);

      // CITY LIST //
      var cityListPane = dom.byId('cityList');
      var cityListPanePos = domGeom.position(cityListPane, true);
      var scrollRightPanePos = domGeom.position('scrollRightPane', true);
      var scrollLeftPanePos = domGeom.position('scrollLeftPane', true);
      var startOfList = false;
      var endOfList = false;
      if(this.isRTL) {
        startOfList = ((cityListPanePos.x + cityListPanePos.w) < scrollLeftPanePos.x);
        endOfList = (cityListPanePos.x > (scrollRightPanePos.x + scrollRightPanePos.w));
      } else {
        startOfList = (cityListPanePos.x > (scrollLeftPanePos.x + scrollLeftPanePos.w));
        endOfList = ((cityListPanePos.w + cityListPanePos.x) < scrollRightPanePos.x);
      }
      domClass.toggle(dom.byId('scrollLeftPane'), 'disabled', startOfList);
      domClass.toggle(dom.byId('scrollRightPane'), 'disabled', endOfList);

    },

    /**
     * SCROLL PANE
     *
     * @param scrollNode
     * @param scrollOptions
     */
    scrollPane: function (scrollNode, scrollOptions) {
      var deferred = new Deferred();

      fx.animateProperty({
        node: scrollNode,
        duration: 1000,
        easing: easing.circInOut,
        properties: {
          scroll: scrollOptions.scroll
        },
        onAnimate: function (values) {
          scrollNode[scrollOptions.direction] = parseFloat(values.scroll.replace(/px/, ''));
        },
        onEnd: deferred.resolve
      }).play();

      return deferred.promise;
    },

    /**
     * TOGGLE CITY LIST PANE
     */
    toggleCityListPane: function () {

      var topTitlePane = registry.byId('topTitlePane');
      var topCityListPane = registry.byId('topCityListPane');
      var topCityListPanePos = domGeom.getMarginBox(topCityListPane.domNode);

      if(topCityListPane._showing && this.isRTL) {
        connect.connect(topCityListPane._hideAnim, 'onEnd', lang.hitch(this, function () {
          // SPECIAL USE CASE //
          domStyle.set(topTitlePane.domNode, {
            left: '', marginRight: '205px'
          });
        }));
      }
      domClass.toggle(topTitlePane.domNode, 'collapsed');
      topCityListPane.toggle();

      domClass.toggle(dom.byId("listByFirstLetter"), 'dijitHidden');

    },

    /**
     * TOGGLE THEME PANE
     */
    toggleThemePane: function () {

      var leftThemeListPane = registry.byId('leftThemeListPane');
      var cityListContainer = registry.byId('cityListContainer');

      if(leftThemeListPane._showing) {
        connect.connect(leftThemeListPane._hideAnim, 'onEnd', lang.hitch(this, function (evt) {
          domClass.toggle(cityListContainer.domNode, 'collapsed');
          domClass.toggle('leftTitlePane', 'collapsed');
        }));
      } else {
        connect.connect(leftThemeListPane._showAnim, 'onEnd', lang.hitch(this, function (evt) {
          domClass.toggle(cityListContainer.domNode, 'collapsed');
          domClass.toggle('leftTitlePane', 'collapsed');
        }));
      }
      leftThemeListPane.toggle();
    },

    /**
     * TOGGLE LEGEND NODE
     *
     * @param legendNode
     */
    toggleLegend: function (legendNode) {
      domClass.toggle(legendNode, 'legendNodeOpen');
      domClass.toggle(legendNode.id + '.legendLabel', 'dijitOffScreen');
    },

    /**
     * SHOW/HIDE LEGEND NODE
     *
     * @param legendNode
     * @param isVisible
     */
    displayLegend: function (legendNode, isVisible) {
      domClass.toggle(legendNode, 'legendNodeOpen', isVisible);
      domClass.toggle(legendNode.id + '.legendLabel', 'dijitOffScreen', isVisible);
    },

    /**
     *  UPDATE BROWSER URL WITH CURRENT PARAMETERS
     */
    updateBrowserUrl: function () {

      // http://caniuse.com/#search=replaceState
      // https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history
      if((window.history) && (window.history.replaceState)) {

        var cityNames = [];
        for (var cityNodeIndex = 1; cityNodeIndex <= this.getPaneCount(); cityNodeIndex++) {
          var cityNode = this.currentSelection.cities[cityNodeIndex];
          if(cityNode && cityNode.cityInfo) {
            cityNames.push(cityNode.cityInfo.name);
          }
        }

        var newUrlParameters = {
          group: this.config.group,
          noun: this.currentSelection.noun,
          theme: this.currentSelection.theme,
          cities: cityNames,
          minLevel: this.config.minLevel,
          level: this.currentSelection.level,
          maxLevel: this.config.maxLevel,
          dualPane: this.config.dualPane
        };

        // UPDATE BROWSER URL //
        window.history.replaceState(null, null, "?" + encodeURIComponent(ioQuery.objectToQuery(newUrlParameters)));

        // UPDATE ADDTHIS SHARE URL //
        addthis_share = {
          title: this.config.i18n.mainPage.socialMediaMessage,
          url: window.location.href
        };

      }
    }

  });

  // VERSION //
  UOCompareApp.version = "2.0.2";

  return UOCompareApp;
});
