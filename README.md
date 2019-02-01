# Urban Observatory Compare Template Application
The Urban Observatory Compare application template allows organizations to host and configure the application with their own content.

### How to deploy to your ArcGIS Online Organization

1. **Host this application from your own web server** 
 
2. **Configure the following parameters** in the ./config/application.json file

    * ***proxyUrl*** - setup and configure a proxy on your server then set the url here.
    * ***portalUrl*** - optional - change to your organization's url if desired.
    * ***oauthappid*** - use app id after this app is configured as an item in your org. (see step #4 below)
 
3. **Add as a Template**  
[Add the template to your ArcGIS Online Organization](http://doc.arcgis.com/en/arcgis-online/create-maps/create-app-templates.htm#ESRI_SECTION1_4E23468F506C444CAEAF3796200F3530)
            
 
4.	**Register Template**  
[Register the app template](http://doc.arcgis.com/en/arcgis-online/create-maps/create-app-templates.htm#ESRI_SECTION1_9F809A4A343D4245A3C72F65687CD8AD), then update the config 'oauthappid' parameter. (see step #2 above)
 
5.	**Organization App Gallery**  
[Use the template](http://doc.arcgis.com/en/arcgis-online/create-maps/create-app-templates.htm#ESRI_SECTION1_AEC03C6B5200440A8D874FAB03ADE4BC) in your organization's app gallery
   
