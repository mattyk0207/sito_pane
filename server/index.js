const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
// const Notification = require('./models/Notification');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: './uploads/' });
const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'sdfklknwaeivow2i4ofmwp30';

//middleware
app.use(express.json());
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

//DB connection
mongoose.connect('mongodb+srv://mattyk0207:DChcpihwwYP1HVAm@cluster0.gwi3na7.mongodb.net/');

// login & register
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt),
            admin: "false",
        });
        res.json(userDoc);
    } catch (e) {
        res.status(400).json(e);
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username: username });

    if (userDoc != null) {
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (passOk) {
            // logged in
            jwt.sign({ username, id: userDoc._id, admin: userDoc.admin }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json({
                    id: userDoc._id,
                    username,
                    admin: userDoc.admin,
                });
            });
        } else {
            res.status(400).json('wrong credentials');
        }
    }
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) { console.log('Err'); throw err; }
        else res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
});

// prodotti
app.post('/product', uploadMiddleware.single('file'), async (req, res) => {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { name, desc, price, hidden } = req.body;
        try {
            const productDoc = await Product.create({
                name,
                desc,
                price,
                imgSrc: newPath,
                hidden,
            });
            res.json(productDoc);
        } catch (e) {
            res.status(500).json(e);
        }
    });
});

app.put('/product', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { name, desc, price, hidden } = req.body;
        const productDoc = await Product.findOne({ name: name });
        await Product.updateOne({ name: name }, {
            desc: desc ? desc : productDoc.desc,
            price: price ? price : productDoc.price,
            imgSrc: newPath ? newPath : productDoc.imgSrc,
            hidden: hidden ? hidden : productDoc.hidden,
        });
        res.json(productDoc);
    });

});

app.get('/product', async (req, res) => {
    let valids = [];
    const products = await Product.find();
    let i = 0;
    for (i; i < products.length; i++) {
        if (!products[i].hidden) valids.push(products[i]);
    }
    res.json(
        // products
        valids
    );
});

app.get('/product/:name', async (req, res) => {
    const { name } = req.params;
    const productDoc = await Product.findOne({ name });
    res.json(productDoc);
});

app.delete('/product/:name', async (req, res) => {
    const { name } = req.params;
    //verifica dell'identità
    const productDoc = await Product.deleteOne({ name });
    res.json(productDoc);
});

// ordini
app.post('/order', async (req, res) => {
    //verifica dell'identità
    const { token } = req.cookies;
    let username = '';
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) { throw err; }
        username = info.username;
    });

    const { productsNames, quantities, desc } = req.body;
    const date = new Date();
    let products = [];
    let prices = [];
    let q = [];
    let n = [];
    let Products = await Product.find();
    Products.forEach(p => {
        productsNames.forEach(pn => {
            if (p.name === pn) {
                products.push(p);
                prices.push(p.price);
                q.push(quantities[productsNames.indexOf(pn)]);
                n.push(productsNames[productsNames.indexOf(pn)]);
            }
            // console.log(p);
        })
    });
    // try {
    const oderDoc = await Order.create({
        username,
        products,
        productNames: n,
        quantities: q,
        prices,
        desc,
        date,
        mark: false,
    });
    res.json(oderDoc);
    // } catch (e) {
    //     console.log(e);
    //     res.status(400).json(e);
    // }
});

app.get('/order', async (req, res) => {
    let a = false;
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
        }
        else {
            a = true;
        }
    });
    if (a) {
        let orders = await Order.find();
        res.json(orders);
    }
})

app.get('/non-marked-order', async (req, res) => {
    let a = false;
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
        }
        else {
            a = true;
        }
    });
    if (a) {
        let orders = await Order.find({ mark: false });
        res.json(orders);
    }
})

app.get('/marked-order', async (req, res) => {
    let a = false;
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
        }
        else {
            a = true;
        }
    });
    if (a) {
        let orders = await Order.find({ mark: true });
        res.json(orders);
    }
})

app.delete('/order/:id', async (req, res) => {
    const { token } = req.cookies;
    const { id } = req.params;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
            return
        }
    });
    let orders = await Order.deleteOne({ _id: id });
    res.json(orders);
})

app.put('/order/:id/mark', async (req, res) => {
    const { token } = req.cookies;
    const { id } = req.params;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
            return
        }
    });
    try {
        let orders = await Order.findByIdAndUpdate({ _id: id }, { mark: true });
        res.json(orders);
    } catch (e) {
        console.log(id);
        res.json(e);
    }
})

app.get('/user/order', async (req, res) => {
    const { token } = req.cookies;
    let name;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        name = info.name;
    });
    res.json(await Order.find({ name }));
})

// notifiche
app.post('/notification', multer().fields([]), async (req, res) => {
    const { token } = req.cookies;
    const { title, content, dest } = req.body;
    const date = new Date();

    let name, id;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        name = info.username;
        id = info._id;
    });

    if (dest != 'all') {
        const userDoc = await User.findOne({ 'username': dest });
        if (userDoc === null) {
            res.status(411).send();
        }
        else {
            const notificationDoc = await Notification.create({
                dest,
                title,
                content,
                date,
                read: false,
            });
            res.json(notificationDoc);
        }
    }
    else {
        const notificationDoc = await Notification.create({
            dest,
            title,
            content,
            date,
            read: false,
        });
        res.json(notificationDoc);
    }
})

app.put('/order/:id/notification', async (req, res) => {
    const { token } = req.cookies;
    const { id } = req.params;

    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        if (!info.admin) {
            res.status(400).json("l'utente non è un amminisratore");
            return
        }
    });
    try {
        let orders = await Notification.findByIdAndUpdate({ _id: id }, { read: true });
        res.json(orders);
    } catch (e) {
        res.json(e);
    }
})

app.get('/notification', async (req, res) => {
    const { token } = req.cookies;
    let name;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        name = info.username;
    });
    let notifications = await Notification.find({ dest: name });
    notifications.push(...await Notification.find({ dest: 'all' }))
    res.json(notifications);
})

app.get('/notification/new', async (req, res) => {
    const { token } = req.cookies;
    let name;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        name = info.username;
    });
    let notifications = await Notification.find({ dest: name, read: false });
    notifications.push(...await Notification.find({ dest: 'all', read: false }));
    res.json(notifications);
})

app.listen(4000, () => { console.log("listening on http://localhost:4000") });