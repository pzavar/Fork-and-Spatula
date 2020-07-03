const measurement = require('../utils/measurements')
var express = require('express');
var router = express.Router();
var foods = require('../utils/food');
var async  = require('express-async-await')
var fetch = require('node-fetch')
var config = require('../config')

var Week = require('../models/weeks')
var Meal = require('../models/meals')

// Also, looking at the Spoonacular API, the Search by Complex might be the approach. The logic flow would be setting query to breakfast, lunch, and dinner. Setting the type to breakfast, lunch and dinner. Setting other preferences according to the user. Then we do 5 searches on each breakfast, lunch and dinner, then from those 15, pick out the meal combination that meets the budget crietria. and and set addRecipeInformation boolean to true.

// 364.8 means 3 dollars and 64 cents
function getCost(recipe){
  console.log(recipe["pricePerServing"] / 100)
  return recipe["pricePerServing"] / 100
}

function buildComplexCall(numberOfResults,type,diet,excludeIngredients) {
  var baseUrl = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${config.spoonacularApiKey}`
  var url = baseUrl + `&type=${type}&number=${numberOfResults}&addRecipeInformation=true`
  if (diet != ""){
    url += `&diet=${diet}`
  }
  if (excludeIngredients != null && excludeIngredients.length != 0){
    for (var i = 0; i < excludeIngredients.length; i++){
      var item = excludeIngredients[i] 
      if (i == 0){
        url += `&exludeIngredients=${item}`
      }
      else{
        url += `, ${item}`
      }
    }
  }
  console.log("Calling complex call with url")
  console.log(url)
  return url
}

/*
 * Goal:
 * Return 3 meals based off their budget
 * Search by complex for each type of meal. (Breakfast, Lunch, Dinner)
 *    Returns n number of meals controlled by the number parameter
 * Optimize for goal cost (c = cost, C = goal cost, plusOrMinus):
 * We have 3 lists. One for each type of meal
 * From each list select an item that satisfies being around the goal cost with a 
 *    flexibility of plus or minus
 *
 * searchByComplex
 * Returns map 
 * {
 *    results: [{...},{...}]     // all info in here
 * }
*/

/*
 * Expected body 
 * costPerMeal = double
 * diet  = string
 * excludeIngredients = list
 * mealsPerDay = int
*/
router.get('/complex',async function(req,res,next){
  // const {costPerMeal,diet,extendedIngredients} = req.body
  var numberOfMeals = 1
  var numberOfResults = numberOfMeals * 2
  var flexibility = 1

  // Use for testing
  var costPerMeal = 200 
  var diet = ""
  // var excludeIngredients = []
  var excludeIngredients = ["salmon","pear"]

  var limit = costPerMeal + flexibility

  results = []

  breakfastSet = []
  breakfastCall = buildComplexCall(numberOfResults,"breakfast",diet,excludeIngredients)
	var breakfastSearch = await fetch(breakfastCall)
  breakfastJson = await breakfastSearch.json()
  breakfastResults = breakfastJson["results"]
  for (var i = 0; i < breakfastResults.length; i++) {
    recipe = breakfastResults[i]
    // console.log(recipe)
    if (getCost(recipe) < limit ){
      if (breakfastSet.length < numberOfMeals){
        breakfastSet.push(recipe)
      }
      else {
        break
      }
    }
  }

  console.log("Breakfast set is ")
  console.log(breakfastSet)

  if (breakfastSet.length != numberOfMeals) {
    res.sendStatus(500);
  }

  var lunchSet = []
  var dinnerSet = []

  mainCourseCall = buildComplexCall(numberOfResults * 2,"main course", diet,excludeIngredients)
	var mainCourseSearch = await fetch(mainCourseCall)
  mainCourseJson = await mainCourseSearch.json()
  mainCourseResults = mainCourseJson["results"]

  for(var i = 0; i < mainCourseResults.length / 2; i++){
    recipe = mainCourseResults[i]
    if (getCost(recipe) < limit ){
      if (lunchSet.length < numberOfMeals){
        lunchSet.push(recipe)
      }
      else {
        break
      }
    }
  }

  console.log("Lunch set is ")
  console.log(lunchSet)
  if (lunchSet.length != numberOfMeals) {
    res.sendStatus(500);
  }
  // TODO: POSSIBLE OVERLAP DUE TO INT DIVISION
  for(var i = mainCourseResults.length / 2; i < mainCourseResults.length ; i++){
    recipe = mainCourseResults[i]
    if (getCost(recipe) < limit ){
      if (dinnerSet.length < numberOfMeals){
        dinnerSet.push(recipe)
      }
      else {
        break
      }
    }
  }
  console.log("Dinner set is ")
  console.log(dinnerSet)
  if (dinnerSet.length != numberOfMeals) {
    res.sendStatus(500);
  }

  console.log(breakfastSet)
  console.log(lunchSet)
  console.log(dinnerSet)

  res.json({
    "breakfast" : breakfastSet,
    "lunch" : lunchSet,
    "dinner" : dinnerSet
  })

})

//
//Gives all relavent info
//Cost per serving
//Nutrition
//Ingredients
router.get('/groceryList',async function(req,res,next){
	var ids = "17281,175323"
	console.log(ids)

	var search = await fetch(`https://api.spoonacular.com/recipes/informationBulk?apiKey=${config.spoonacularApiKey}&ids=${ids}&includeNutrition=true`)
	var json = await search.json()
	console.log(json)
	var result = []
	json.forEach(meal => {
		meal["extendedIngredients"].forEach(ingredient => {
			result.push(ingredient["original"])
		})
	})
	console.log(result)
	res.send(result)

	//Pseudocode for extrating recipes
	//list of meals -> meal["extendedIngredients"]
	//list of indredients -> ingredient["original"]
})

module.exports = router;
