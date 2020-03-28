var express = require('express');
var app = express()

var expressSession = require('express-session');
var passport = require('passport');
var localStrategy = require('passport-local');
var passportLocalMongoose = require('passport-local-mongoose');

app.use(expressSession({
    secret : "Hi this is Siddharth",
    resave: false,
    saveUninitialized : false
}));



var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

var ejs = require('ejs');
app.use(express.static(("public")));

var expressSanitizer = require('express-sanitizer');
app.use(expressSanitizer());

var methodOverride = require('method-override');
app.use(methodOverride('_method'));

var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/ExpenseTracker', { useNewUrlParser: true });

var UserSchema =  new mongoose.Schema({
    username : String,
    password : String
});
UserSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", UserSchema);
passport.use(new localStrategy(User.authenticate()));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    next();
});

var expenseSchema = new mongoose.Schema({
    user : {
        id : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User"
        },
        username : String
    },
    category: String,
    description: String,
    amount: Number,
    date : {type : Date, default : Date.now}
});

var expense = mongoose.model("expense", expenseSchema);


//functions to get  years for the dropdown menu
var monthArray = [];
monthArray[0] = "January";
monthArray[1] = "February";
monthArray[2] = "March";
monthArray[3] = "April";
monthArray[4] = "May";
monthArray[5] = "June";
monthArray[6] = "July";
monthArray[7] = "August";
monthArray[8] = "September";
monthArray[9] = "October";
monthArray[10] = "November";
monthArray[11] = "December";

var yearsArray = [];
for(var y = 2000; y<=2500; y++){
    yearsArray.push(y);
}


//********************************** */

// auth routes

//sign up form

app.get('/register', function(req, res){
    res.render('register.ejs');
});

// sign up logic

app.post('/register', function(req, res){
    User.register(new User({username : req.body.username}), req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.redirect("/");
        }

        passport.authenticate("local")(req, res, function(){
            res.redirect('/home');
        });
    } );
});
//login form

app.get('/login', function(req, res){
    res.render('login.ejs');
});

app.post('/login', passport.authenticate("local", {
    successRedirect : '/home',
    failureRedirect : '/'
}), function(req, res){
    
});

//logout

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});
//**************************** */

app.get('/', function(req, res){
    res.render('home.ejs');
});

app.get('/home', isLoggedIn, function(req, res){
    res.render('loggedinhome.ejs');
});

app.get("/expenses", isLoggedIn, function(req, res){
    
    
    var sumExpenses  = 0;
    var sumExpensesPerMonth = 0;
    var date = new Date();
    var currentMonthExpensesList = [];
    app.locals.currentMonth = date.getMonth();
    // console.log(date.getMonth());
    // console.log(date.getFullYear());

    expense.find({ 'user.username' : req.user.username }, function(err, expenses){
        var allExpensesList = expenses;
        var categoryExpenses = calculateCategoryExpenses(allExpensesList);
        //console.log(allExpensesList);
        allExpensesList.forEach(function(expenseitem){
            //calculating total expenses
            sumExpenses += expenseitem.amount;
            var expenseDate = new Date(expenseitem.date);
            // console.log(expenseDate.getMonth());
            // console.log(expenseDate.getFullYear());
           if((date.getMonth() === expenseDate.getMonth()) && (date.getFullYear() === expenseDate.getFullYear())){
               sumExpensesPerMonth+=expenseitem.amount;
             currentMonthExpensesList.push(expenseitem);
           }
        });
        // console.log('############');
        // console.log(currentMonthExpensesList);
        var categoryExpensesPerMonth = calculateCategoryExpensesPerMonth(currentMonthExpensesList);
        res.render("index.ejs", {currentMonthExpensesList : currentMonthExpensesList, monthArray : monthArray, yearsArray : yearsArray, sumExpenses : sumExpenses, sumExpensesPerMonth : sumExpensesPerMonth, categoryExpenses : categoryExpenses, categoryExpensesPerMonth : categoryExpensesPerMonth});
    });
    
});

app.post("/expenses/search", isLoggedIn, function(req, res){
    var sumExpenses  = 0;
    var sumExpensesPerMonth = 0;
    var month = req.body.monthPicker;
    app.locals.currentMonth = month-1;
    // console.log(req.body.monthPicker);
    // console.log(req.body.yearPicker);

    var currentMonthExpensesList = [];
    
    expense.find({'user.username' : req.user.username}, function(err, expenses){
        var allExpensesList = expenses;
        var categoryExpenses = calculateCategoryExpenses(allExpensesList);
        allExpensesList.forEach(function(expenseitem){
            //calculating total expenses
            sumExpenses += expenseitem.amount;

            var expenseDate = new Date(expenseitem.date);
            // console.log(expenseDate.getMonth()+1);
            // console.log(expenseDate.getFullYear());
           if((req.body.monthPicker == expenseDate.getMonth()+1) && (req.body.yearPicker == expenseDate.getFullYear())){
            sumExpensesPerMonth+=expenseitem.amount;
             currentMonthExpensesList.push(expenseitem);
           }
        });
        // console.log('############');
        // console.log(currentMonthExpensesList);
        var categoryExpensesPerMonth = calculateCategoryExpensesPerMonth(currentMonthExpensesList);
        res.render("index.ejs", {currentMonthExpensesList : currentMonthExpensesList, monthArray : monthArray, yearsArray : yearsArray, sumExpenses : sumExpenses, sumExpensesPerMonth : sumExpensesPerMonth, categoryExpenses : categoryExpenses, categoryExpensesPerMonth : categoryExpensesPerMonth});
    });

});

app.get("/expenses/new", isLoggedIn, function(req, res){
    res.render('new.ejs');
});

app.post("/expenses", isLoggedIn, function(req, res){
    req.body.expense.description = req.sanitize(req.body.expense.description);
    console.log(req.user._id);
    console.log(req.user.username);

    console.log(req.body.expense);
    expense.create(req.body.expense, function(err, createdExpense){
        if(err){
            res.redirect("/expenses/new");
        }
        else{
            createdExpense.user.id = req.user._id;
            createdExpense.user.username = req.user.username;
            createdExpense.save();
            res.redirect("/home");
        }
    });
});


//form to edit expenses

app.get("/expenses/:id/edit", function(req, res){
    
    expense.findById(req.params.id, function(err, foundExpense){
        if(err){
            res.redirect("/expenses");
        }
        else{
            res.render("edit.ejs", {foundExpense : foundExpense});
        }
    });
});

//saving edites expense

app.put("/expenses/:id", function(req, res){
    expense.findByIdAndUpdate(req.params.id, req.body.expense, function(err, updatedBlog){
        res.redirect("/home");
    });
});

// function that calculates total category wise expenses so far
function calculateCategoryExpenses(expenses){
    var categoryExpenses = {};
    expenses.forEach(function(expense){
        if(!(expense.category in categoryExpenses)){
            categoryExpenses[expense.category] = expense.amount; 
        }
        else{
            categoryExpenses[expense.category] = categoryExpenses[expense.category] + expense.amount;
        }
    });

    //console.log(categoryExpenses);
    return categoryExpenses
}

// function that calculates total category wise expenses per month
function calculateCategoryExpensesPerMonth(expenses){
    var categoryExpensesPerMonth = {};
    expenses.forEach(function(expense){
        if(!(expense.category in categoryExpensesPerMonth)){
            categoryExpensesPerMonth[expense.category] = expense.amount; 
        }
        else{
            categoryExpensesPerMonth[expense.category] = categoryExpensesPerMonth[expense.category] + expense.amount;
        }
    });

    //console.log(categoryExpensesPerMonth);
    return categoryExpensesPerMonth;
}


//middleware to check if user is logged in

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }

    res.redirect('/login');
}


app.listen(3000,function(){
    console.log('app started');
});
