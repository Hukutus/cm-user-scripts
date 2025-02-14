# cm-userscripts
- Userscripts for making Cardmarket nicer to use

## Installation

Have a userscript runner installed, add the scripts
- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) iOS application

## Scripts

### CM_Offers_UI
- Creates a new UI for Cardmarket offers while hiding the original table
- <img src="public/CM_Offers_UI_image.png" width="500px" alt="Example screenshot of the script displaying the UI">

### CM_Offers_Feed
- Requires `CM_Offers_UI` to be installed
- Loads the next offers page in a hidden iframes and notifies `CM_Offers_UI`, which then creates elements for the iframe table contents
- *Note:* Adding a product into the cart via an iframe element will not update the cart badge number even though adding to cart succeeds
- <img src="public/CM_Offers_Feed_image.png" width="500px" alt="Example animation of the script loading a new page">

### CM_Shipping_Estimate
- Displays shipping estimate for sellers on the singles page
- Persists requested shipping estimates with `GM.setValue` to be reused
- *Note:* Does not account for custom shipping options provided by professional sellers
- <img src="public/CM_Shipping_Estimate_image.png" width="500px" alt="Example screenshot of the script displaying shipping estimates">
