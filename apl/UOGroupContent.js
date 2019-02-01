define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/connect",
  "dojo/dom-class",
  "dojo/Deferred",
  "dojo/promise/all",
  "dojo/store/Memory",
  "dojo/store/Observable",
  "esri/kernel",
  "esri/request",
  "esri/arcgis/Portal",
  "esri/IdentityManager"
], function (declare, lang, array, connect, domClass, Deferred, all, Memory, Observable, esriKernel, esriRequest, esriPortal, IdentityManager) {
  /**
   * apl.UOGroupContent
   */
  return declare([], {

    // CLASS NAME //
    declaredClass: 'apl.UOGroupContent',

    // PORTAL //
    portal: null,
    portalGroup: null,

    // GROUP //
    group: null,

    // TAGS //
    _baseTag: 'Urban',
    _tagDelimiter: '.',

    // STORE //
    _webmapStore: null,
    _cities: [],
    _themes: [],

    /**
     * constructor
     *
     * @param options
     */
    constructor: function (options) {
      lang.mixin(this, options);

      // PROTOCOL MISMATCH //
      esriKernel.id.setProtocolErrorHandler(function () {
        return true;
      });

      // STORE OF WEBMAPS//
      this._webmapStore = new Observable(new Memory({
        data: []
      }));

      this.addCity = lang.hitch(this, this.addCity);
      this.addTheme = lang.hitch(this, this.addTheme);
      this.getWebmapsInGroup = lang.hitch(this, this.getWebmapsInGroup);
      this.getItemTags = lang.hitch(this, this.getItemTags);
      this.getCities = lang.hitch(this, this.getCities);
      this.getThemesForNoun = lang.hitch(this, this.getThemesForNoun);
      this.getThumbnailUrl = lang.hitch(this, this.getThumbnailUrl);
      this.getWebmap = lang.hitch(this, this.getWebmap);
      this.findWebmap = lang.hitch(this, this.findWebmap);
    },

    /**
     * buildItemList
     */
    buildItemList: function () {
      var deferred = new Deferred();

      this.getWebmapsInGroup().then(lang.hitch(this, function (webmaps) {
        array.forEach(webmaps, lang.hitch(this, this.loadWebmapInStore));
        deferred.resolve();
      }));

      return deferred.promise;
    },

    /**
     * getPortal
     *
     * @returns {*}
     */
    getPortal: function () {
      var deferred = new Deferred();

      if(this.portal) {
        deferred.resolve();
      } else {
        // CREATE PORTAL INSTANCE //
        this.portal = new esriPortal.Portal(this.sharinghost);

        // WAIT PORTAL LOADED //
        connect.connect(this.portal, 'onLoad', lang.hitch(this, function () {
          var serverInfo = esriKernel.id.findServerInfo(this.sharinghost);
          if(!serverInfo) {
            this.portal.signIn().then(deferred.resolve, deferred.reject);
          } else {
            deferred.resolve();
          }
        }));
      }

      return deferred.promise;
    },

    /**
     * getGroup
     *
     * @param retry
     * @returns {*}
     */
    getGroup: function (retry) {
      var deferred = new Deferred();

      // QUERY: USE GROUP ID //
      var groupQuery = lang.replace("id:{group}", this);

      // SEARCH FOR GROUP //
      this.portal.queryGroups({
        // GROUP QUERY PARAMETERS //
        q: groupQuery
      }).then(lang.hitch(this, function (response) {
        if(response.results.length > 0) {
          deferred.resolve(response.results[0]);
        } else {
          if(!retry) {
            // WE COULDN'T FIND THE GROUP, BUT WE KNOW IT EXISTS SO //
            // THIS MEANS WE MUST ASK FOR CREDENTIALS AND TRY AGAIN //
            this.portal.signIn().then(lang.hitch(this, function (signedInUser) {
              this.getGroup(true).then(deferred.resolve, deferred.reject);
            }), deferred.reject);
          } else {
            // WE COULDN'T FIND THE GROUP, EVEN AFTER PROMPTING FOR CREDENTIALS //
            deferred.reject();
          }
        }
      }));

      return deferred.promise;
    },

    /**
     * getWebmapsInGroup
     *
     * @return {*}
     */
    getWebmapsInGroup: function () {
      var deferred = new Deferred();

      // GET PORTAL //
      this.getPortal().then(lang.hitch(this, function () {

        // GET GROUP //
        this.getGroup().then(lang.hitch(this, function (group) {

          // SET PORTAL GROUP //
          this.portalGroup = group;

          // ITEM SEARCH PARAMETERS //
          var queryParams = {
            q: lang.replace('type:"web map" tags:{_baseTag}{_tagDelimiter}*', this),
            sortField: 'title',
            sortOrder: 'asc',
            start: 0,
            num: 100
          };

          // SEARCH FOR *ALL* ITEMS RECURSIVELY //
          this.searchItemsInGroup(queryParams).then(lang.hitch(this, function (allResults) {
            if(allResults.length > 0) {
              deferred.resolve(allResults);
            } else {
              this.portal.signIn().then(lang.hitch(this, function (signedInUser) {
                this.searchItemsInGroup(queryParams).then(deferred.resolve, deferred.reject);
              }), deferred.reject);
            }
          }));

        }), lang.hitch(this, function () {
          alert("Could NOT find configured Group: " + this.group);
          deferred.reject();
        }));
      }));

      return deferred.promise;
    },

    /**
     * SEARCH FOR ITEMS IN A GROUP
     *   NOTE/CAUTION: THIS FUNCTION WILL RECURSIVELY CALL
     *   ITSELF TO GET ALL RESULTS BEFORE THEY'RE SENT BACK
     *
     * @param queryParams
     * @param allResults
     * @returns {*}
     */
    searchItemsInGroup: function (queryParams, allResults) {
      var deferred = new Deferred();

      if(!allResults) {
        // ARRAY TO HOLD ALL RESULTS //
        allResults = [];
      }
      this.portalGroup.queryItems(queryParams).then(lang.hitch(this, function (response) {
        // CONCAT RESULTS //
        allResults = allResults.concat(response.results);
        if(response.nextQueryParams.start > -1) {
          // SEARCH AGAIN IF WE HAVE MORE RESULTS THAN WERE RETURNED //
          var otherQueriesDeferreds = [];
          for (var nextIndex = response.nextQueryParams.start; nextIndex < response.total; nextIndex += queryParams.num) {
            var otherQuery = this.portalGroup.queryItems(lang.mixin(queryParams, { start: nextIndex }));
            otherQueriesDeferreds.push(otherQuery);
          }
          all(otherQueriesDeferreds).then(lang.hitch(this, function (otherQueryResults) {
            array.forEach(otherQueryResults, lang.hitch(this, function (otherQueryResult) {
              allResults = allResults.concat(otherQueryResult.results);
            }));
            deferred.resolve(allResults);
          }), lang.hitch(this, function (error) {
            console.warn(error);
          }));

        } else {
          // RETURN ALL RESULTS IF THERE ARE NO MORE RESULTS TO SEARCH FOR //
          deferred.resolve(allResults);
        }
      }));

      return deferred.promise;
    },

    /**
     * loadWebmapInStore
     *
     * @param webmap
     */
    loadWebmapInStore: function (webmap) {

      var uoTags = this.getItemTags(webmap);
      if(uoTags.length > 0) {
        var uoTag = uoTags[0];
        var tagParts = uoTag.split(this._tagDelimiter);
        if(tagParts.length !== 4) {
          console.warn("Invalid number of tag parts: ", uoTag, webmap);
          return;
        }

        webmap.uoTag = uoTag;
        webmap.cityName = tagParts[1].replace(/_/g, ' ');
        webmap.nounName = tagParts[2];
        webmap.themeName = tagParts[3].replace(/_/g, ' ');

        var foundWebmap = this._webmapStore.get(webmap.id);
        if(foundWebmap) {
          console.info("FOUND DUPLICATES-- About to load:", foundWebmap, "Already loaded:", webmap);
        } else {
          this._webmapStore.add(webmap);
        }

        this.addCity(webmap.cityName);
        this.addTheme(webmap.nounName, webmap.themeName);
      }
    },

    /**
     * getItemCount
     *
     * @returns {Number}
     */
    getItemCount: function () {
      //console.log(this._webmapStore);
      return this._webmapStore.data.length;
    },

    /**
     * getItemTags
     *
     * @param webmap
     * @return {Array}
     */
    getItemTags: function (webmap) {
      return array.filter(webmap.tags, lang.hitch(this, function (tag) {
        return (tag.indexOf(lang.replace("{_baseTag}{_tagDelimiter}", this)) === 0);
      }));
    },

    /**
     * addCity
     *
     * @param cityName
     */
    addCity: function (cityName) {
      var hasCity = (array.indexOf(this._cities, cityName) > -1);
      if(!hasCity) {
        this._cities.push(cityName);
      }
    },

    /**
     * addTheme
     *
     * @param noun
     * @param theme
     */
    addTheme: function (noun, theme) {
      if(!this._themes[noun]) {
        this._themes[noun] = [];
      }
      var hasTheme = (array.indexOf(this._themes[noun], theme) > -1);
      if(!hasTheme) {
        this._themes[noun].push(theme);
      }
    },

    /**
     * getCities
     *
     * @return {*}
     */
    getCities: function () {
      return this._cities;
    },

    /**
     * getCitiesCount
     *
     * @returns {int}
     */
    getCitiesCount: function () {
      return this.getCities().length;
    },

    /**
     * getThemesCount
     *
     * @returns {number}
     */
    getThemesCount: function () {
      var themeCount = 0;
      array.forEach(this.getNouns(), lang.hitch(this, function (noun) {
        themeCount += this.getThemesForNoun(noun).length;
      }));
      return themeCount;
    },

    /**
     * getCitiesForTheme
     *
     * @param noun
     * @param theme
     * @returns {*|Array}
     */
    getCitiesForTheme: function (noun, theme) {
      var cityItems = this._webmapStore.query({ nounName: noun, themeName: theme });
      return array.map(cityItems, function (cityItem) {
        return cityItem.cityName;
      });
    },

    /**
     * getCitiesForTheme2
     *
     * @param noun
     * @param theme
     * @returns {*}
     */
    getCitiesForTheme2: function (noun, theme) {
      var cityItems = this._webmapStore.query({
        nounName: noun,
        themeName: theme
      });
      //console.log("getCitiesForTheme: ",cityItems);
      return array.map(cityItems, function (cityItem) {
        return cityItem.cityName;
      });
    },

    /**
     * getNouns
     *
     * @return {Array}
     */
    getNouns: function () {
      /* var nouns = [];
       for (var noun in this._themes) {
       if(this._themes.hasOwnProperty(noun)) {
       nouns.push(noun);
       }
       }
       return nouns;*/
      return Object.keys(this._themes);
    },

    /**
     * getThemesForNoun
     *
     * @param noun
     * @return {*}
     */
    getThemesForNoun: function (noun) {
      return this._themes[noun];
    },

    /**
     * getThemesForCity
     *
     * @param cityName
     * @returns {*}
     */
    getThemesForCity: function (cityName) {
      return this._webmapStore.query({
        cityName: cityName
      });
    },

    /**
     * getThumbnailUrl
     *
     * @param city
     * @param noun
     * @param theme
     * @return {*}
     */
    getThumbnailUrl: function (city, noun, theme) {
      var webmap = this.getWebmap(city, noun, theme);
      if(webmap) {
        return webmap.thumbnailUrl || "./images/desktopapp.png";
      } else {
        return "./images/desktopapp.png";
      }
    },

    /**
     * getWebmap
     *
     * @param city
     * @param noun
     * @param theme
     * @return {*}
     */
    getWebmap: function (city, noun, theme) {
      var searchTag = lang.replace("{0}{1}{2}{1}{3}{1}{4}", [
        this._baseTag,
        this._tagDelimiter,
        city.replace(/ /g, '_'),
        noun,
        theme.replace(/ /g, '_')
      ]);
      //console.log("getWebmap: ",city,noun,theme,searchTag);
      return this.findWebmap(searchTag);
    },

    /**
     * findWebmap
     *
     * @param searchTag
     * @return {*}
     */
    findWebmap: function (searchTag) {
      //console.log("findWebMap: ",searchTag);
      var webmaps = this._webmapStore.query({ uoTag: searchTag });
      if(webmaps.length > 0) {
        return webmaps[0];
      } else {
        return null;
      }
    },

    /**
     * createThemeStore
     *
     * @returns {Observable}
     */
    createThemeStore: function () {
      var themeData = [];
      var nouns = this.getNouns();
      array.forEach(nouns, lang.hitch(this, function (noun) {
        var themes = this.getThemesForNoun(noun);
        array.forEach(themes, lang.hitch(this, function (theme) {
          var themeItem = {
            themeInfo: lang.replace("{0}: {1}", [noun, theme])
          };
          var cityNames = this.getCitiesForTheme2(noun, theme);
          array.forEach(cityNames, lang.hitch(this, function (cityName) {
            themeItem[cityName] = this.getThumbnailUrl(cityName, noun, theme);
          }));
          themeData.push(themeItem);
        }));
      }));

      return new Observable(new Memory({
        data: themeData
      }));
    }

  });
});