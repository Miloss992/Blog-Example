require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser')
const _ = require('lodash');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const flash = require('connect-flash');
const mongoosePaginate = require('mongoose-paginate-v2');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(flash());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    phone: String
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model('user', userSchema);

const commentSchema = new mongoose.Schema({
    commenter: String,
    comment: String,
});

const subscriberSchema = new mongoose.Schema({
    subscriberMail: String,
});
const Subscriber = mongoose.model('subscriber', subscriberSchema);

const postSchema = new mongoose.Schema({
    postTitle: String,
    postAuthor: String,
    postContext: String,
    postImg: String,
    category: String,
    date: Date,
    comment: [commentSchema],
});
postSchema.plugin(mongoosePaginate);
const Posts = mongoose.model("post", postSchema);

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

mongoose.connect(process.env.DB);

app.get('/Register', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/');
    }
    else {
        res.render('register', { message: req.flash('info'), login: req.isAuthenticated() });
    }

});

app.post('/Register', (req, res) => {
    if (req.body.password !== req.body.confirmPassword) {
        req.flash('info', 'Password and Confirm password do not match.');
        res.redirect('/register');
    }
    else {
        User.findOne({ username: req.body.username }).then((data) => {
            if (data === null) {
                User.register(new User({ username: req.body.username }), req.body.password, (err) => {
                    if (err) {
                        console.log('error while user registering!', err);
                        req.flash('info', 'There was an error while registering.');
                        res.redirect('/register');
                    }
                    else {
                        res.redirect('/');
                    }
                });
            }
            else {
                req.flash('info', 'This email address is already taken.');
                res.redirect('/register');
            }
        })
    }
});

app.get('/Login', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/');
    }
    else {
        res.render('login', { message: req.flash('info'), login: req.isAuthenticated() });
    }
});

app.post('/Login', passport.authenticate('local', { failureRedirect: '/login', failureFlash: { type: 'info', message: 'Email or Password Is Incorrect.' }, }), (req, res) => {
    res.redirect('/');
});

app.post('/Logout', (req, res, next) => {
    if (req.isAuthenticated()) {
        req.logout((err) => {
            if (err) { return next(err); }
            res.redirect('/');
        });
    }
    else {
        res.redirect('/');
    }
});

app.get('/', (req, res) => {
    function renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10) {
        const options = {
            page: currentPage,
            limit: 4,
            collation: {
                locale: 'en',
            },
        };
        Posts.paginate({}, options, function (err, result) {
            if (result.docs != []) {
                const options = { totalDocs: result.totalDocs, firstPost: firstPost, secondPost: secondPost, thirdPost: thirdPost, last10: last10, result: result.docs.reverse(), page: 1, next: true, prev: false, login: req.isAuthenticated() };
                return res.render('home', options);
            }
            else {
                const options = { totalDocs: 0, firstPost: firstPost, secondPost: secondPost, thirdPost: thirdPost, last10: last10, result: [], page: 1, next: false, prev: false, login: req.isAuthenticated() };
                return res.render('home', options);
            }
        });
    }
    Posts.find({}).sort('-date').then((data) => {
        const firstPost = data[0];
        const secondPost = data[1];
        const thirdPost = data[2];
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);

        if (req.body.nextPage === 'next') {
            let currentPage = Number(req.body.page) + 1;
            renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
        }
        else {
            if (req.body.prevPage === 'previous') {
                let currentPage = Number(req.body.page) - 1;
                renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
            }
            else {
                let currentPage = 1;
                renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
            }
        }
    });
});

app.get('/subscribe', (req, res) => {
    Posts.find({}).sort('-date').then((data) => {
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);
        const options = { last10: last10, message: req.flash('info'), login: req.isAuthenticated() };
        res.render('subscribe', options);
    });
});

app.get('/subscribersList', (req, res) => {
    Subscriber.find({
    }).then((data) => {
        res.send(data);
    });
});

app.get('/contact', (req, res) => {
    Posts.find({}).sort('-date').then((data) => {
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);
        const options = { last10: last10, login: req.isAuthenticated() };
        res.render('contact', options);
    });
});

app.get('/compose', (req, res) => {
    if (req.isAuthenticated()) {
        Posts.find({}).sort('-date').then((data) => {
            const recentArticles = [];
            data.forEach(e => {
                recentArticles.push(e.postTitle);
            });
            const last10 = recentArticles.slice(0, 10);
            const options = { last10: last10, login: req.isAuthenticated() };
            res.render('compose', options);
        });
    }
    else {
        res.redirect('/');
    }
});

app.get('/:category', (req, res) => {
    function renderPage(req, res, currentPage, last10) {
        const options = {
            page: currentPage,
            limit: 4,
            collation: {
                locale: 'en',
            },
        };
        Posts.paginate({ 'category': req.params.category }, options, (err, result) => {
            if (result.docs != []) {
                const options = { totalDocs: result.totalDocs, category: req.params.category, last10: last10, result: result.docs.reverse(), page: 1, next: true, prev: false, login: req.isAuthenticated() };
                return res.render('category', options);
            }
            else {
                const options = { totalDocs: 0, category: req.params.category, last10: last10, result: [], page: currentPage, next: false, prev: false, login: req.isAuthenticated() };
                return res.render('category', options);
            }
        });
    }
    Posts.find({}).sort('-date').then((data) => {
        const categories = ['Category1', 'Category2', 'Category3', 'Category4'];
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);
        if (categories.includes(req.params.category)) {

            if (req.body.nextPage === 'next') {
                let currentPage = Number(req.body.page) + 1;
                renderPage(req, res, currentPage, last10);
            }
            else {
                if (req.body.prevPage === 'previous') {
                    let currentPage = Number(req.body.page) - 1;
                    renderPage(req, res, currentPage, last10);
                }
                else {
                    let currentPage = 1;
                    renderPage(req, res, currentPage, last10);
                }
            }
        }
        else {
            res.redirect('/');
        }
    });
});

app.get('/posts/:title', (req, res) => {
    Posts.find({}).sort('-date').then((result) => {
        const recentArticles = [];
        result.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);
        const title = _.capitalize(req.params.title);
        Posts.findOne({ postTitle: title }).then((data) => {
            if (data === null) {
                res.redirect(`/`);
            }
            else {
                const options = { last10: last10, data: data, login: req.isAuthenticated() };
                res.render('post', options);
            }
        });
    });
});

app.post('/post', (req, res) => {
    Posts.findOne({ postTitle: req.body.postTitle }).then((data) => {
        if (data === null) {
            res.redirect(`/`);
        }
        else {
            Posts.findOneAndUpdate({ postTitle: req.body.postTitle }, { $push: { comment: { commenter: req.body.commenter, comment: req.body.comment } } }).then((data) => {
                res.redirect(`/posts/${req.body.postTitle}`)
            });
        }
    });
});

app.post('/compose', (req, res) => {
    Posts.create({
        postTitle: _.capitalize(req.body.postTitle),
        postAuthor: _.capitalize(req.body.postAuthor),
        postContext: req.body.postContext,
        postImg: req.body.postImg,
        category: req.body.category,
        date: new Date(),
        comment: [{
            commenter: "",
            comment: "",
        }],
    }).then(() => {
        res.redirect('/');
    });
});

app.post('/subscribe', (req, res) => {
    Subscriber.create({
        subscriberMail: req.body.subscriberMail,
    }).then(() => {
        req.flash('info', 'Successfully subscribed to newsletter.');
        res.redirect('/subscribe');
    });
});

app.post('/', (req, res) => {
    function renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10) {
        const options = {
            page: currentPage,
            limit: 4,
            collation: {
                locale: 'en',
            },
        };
        Posts.paginate({}, options, function (err, result) {
            if (result.docs != []) {
                const options = { totalDocs: result.totalDocs, firstPost: firstPost, secondPost: secondPost, thirdPost: thirdPost, last10: last10, result: result.docs.reverse(), page: currentPage, next: result.hasNextPage, prev: result.hasPrevPage, login: req.isAuthenticated() };
                return res.render('home', options);
            }
            else {
                const options = { totalDocs: 0, firstPost: firstPost, secondPost: secondPost, thirdPost: thirdPost, last10: last10, result: [], page: currentPage, next: false, prev: false, login: req.isAuthenticated() };
                return res.render('home', options);
            }
        });
    }
    Posts.find({}).sort('-date').then((data) => {
        const firstPost = data[0];
        const secondPost = data[1];
        const thirdPost = data[2];
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);

        if (req.body.nextPage === 'next') {
            let currentPage = Number(req.body.page) + 1;
            renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
        }
        else {
            if (req.body.prevPage === 'previous') {
                let currentPage = Number(req.body.page) - 1;
                renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
            }
            else {
                let currentPage = 1;
                renderPage(req, res, currentPage, firstPost, secondPost, thirdPost, last10);
            }
        }
    });
});

app.post('/search', (req, res) => {
    function renderPage(req, res, currentPage, last10) {
        const options = {
            page: currentPage,
            limit: 4,
            collation: {
                locale: 'en',
            },
        };
        Posts.paginate({ 'postContext': { '$regex': req.body.search, '$options': 'i', } }, options, (err, result) => {
            if (result.docs != []) {
                const options = { totalDocs: result.totalDocs, last10: last10, result: result.docs.reverse(), search: req.body.search, page: currentPage, next: result.hasNextPage, prev: result.hasPrevPage, login: req.isAuthenticated() };
                return res.render('search', options);
            }
            else {
                const options = { totalDocs: 0, last10: last10, result: [], search: req.body.search, page: currentPage, next: false, prev: false, login: req.isAuthenticated() };
                return res.render('search', options);
            }
        });
    }
    Posts.find({}).sort('-date').then((data) => {
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);

        if (req.body.nextPage === 'next') {
            let currentPage = Number(req.body.page) + 1;
            renderPage(req, res, currentPage, last10);
        }
        else {
            if (req.body.prevPage === 'previous') {
                let currentPage = Number(req.body.page) - 1;
                renderPage(req, res, currentPage, last10);
            }
            else {
                let currentPage = 1;
                renderPage(req, res, currentPage, last10);
            }
        }
    });
});

app.post('/:category', (req, res) => {
    function renderPage(req, res, currentPage, last10) {
        const options = {
            page: currentPage,
            limit: 4,
            collation: {
                locale: 'en',
            },
        };
        Posts.paginate({ 'category': req.params.category }, options, (err, result) => {
            if (result.docs != []) {
                const options = { totalDocs: result.totalDocs, category: req.params.category, last10: last10, result: result.docs.reverse(), page: currentPage, next: result.hasNextPage, prev: result.hasPrevPage, login: req.isAuthenticated() };
                return res.render('category', options);
            }
            else {
                const options = { totalDocs: 0, category: req.params.category, last10: last10, result: [], page: currentPage, next: false, prev: false, login: req.isAuthenticated() };
                return res.render('category', options);
            }
        });
    }
    Posts.find({}).sort('-date').then((data) => {
        const categories = ['Category1', 'Category2', 'Category3', 'Category4'];
        const recentArticles = [];
        data.forEach(e => {
            recentArticles.push(e.postTitle);
        });
        const last10 = recentArticles.slice(0, 10);
        if (categories.includes(req.params.category)) {
            if (req.body.nextPage === 'next') {
                let currentPage = Number(req.body.page) + 1;
                renderPage(req, res, currentPage, last10);
            }
            else {
                if (req.body.prevPage === 'previous') {
                    let currentPage = Number(req.body.page) - 1;
                    renderPage(req, res, currentPage, last10);
                }
                else {
                    let currentPage = 1;
                    renderPage(req, res, currentPage, last10);
                }
            }
        }
        else {
            res.redirect('/');
        }
    });
});

app.use(function (req, res, next) {
    res.status(404);
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
