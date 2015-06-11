/*global define,location */
/*jslint sloppy:true */
/*
 | Copyright 2014 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define({
  "noun": "People",
  "theme": "Population Density",
  "cities": "New York,London,Tokyo",
  "minLevel": 8,
  "level": 10,
  "maxLevel": 16,
  "dualPane": false,
  //Default configuration settings for the application. This is where you'll define things like a bing maps key,
  //default web map, default app color theme and more. These values can be overwritten by template configuration settings and url parameters.
  "appid": "",
  "webmap": null,
  "oauthappid": null,
  //Group templates must support a group url parameter. This will contain the id of the group.
  "group": "f4373b6eae144e26a634937269d336ec",
  //Enter the url to the proxy if needed by the application. See the 'Using the proxy page' help topic for details
  //http://developers.arcgis.com/en/javascript/jshelp/ags_proxy.html
  "proxyurl": "../resources/proxy.ashx",
  //Enter the url to your organizations bing maps key if you want to use bing basemaps
  "bingKey": "",
  //Defaults to arcgis.com. Set this value to your portal or organization host name.
  "sharinghost": location.protocol + "//" + "www.arcgis.com",
  "units": null,
  //If your application needs to edit feature layer fields set this value to true. When false the map will
  //be created with layers that are not set to editable which allows the FeatureLayer to load features optimally.
  "editable": false,
  "helperServices": {
    "geometry": {
      "url": null
    },
    "printTask": {
      "url": null
    },
    "elevationSync": {
      "url": null
    },
    "geocode": [{
      "url": null
    }]
  }
});