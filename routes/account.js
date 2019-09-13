import express from "express";
import {authenticateUser} from "../middlewares/auth";
import bcrypt from 'bcrypt';
import {userFilter} from "../filters/user";
import jwt from 'jsonwebtoken';

export const router = express.Router();
export const prefix = '/account';

const saltRounds = 10;

const {accountStore} = require('../data/DataStore');


/* GET users listing. */
router.get('/status', authenticateUser, function (req, res, next) {
    res.send(
        {
            user: {
                name: req.user.name,
                ...userFilter(accountStore.get(`users.${req.user.name}`))
            }
        }
    );
});

router.post('/login', async function (req, res) {
    if (!req.body.name || !req.body.pass) {
        res.status(401).send({msg: 'Expected a payload of name and pass.'});
        return;
    }

    const name = req.body.name.toLowerCase();
    const pass = req.body.pass;

    let user = accountStore.get(`users.${name}`);
    if (!user) {
        res.status(401).send({msg: `User '${req.body.name}' is not a registered user.`});
        return;
    }
    const result = await checkUser(name, pass);
    if (!result) {
        res.status(401).send({msg: 'Bad username or password.'});
        return;
    }
    const token = jwt.sign({
        name,
        data: accountStore.get(`users.${name}.data`)
    }, process.env.SECRET_KEY, {expiresIn: '30d'});

    res.send({jwt: token});
});


router.post('/create', function (req, res) {
    if (!req.body.name || !req.body.pass) {
        res.status(401).send({msg: 'Expected a payload of name and pass.'});
        return;
    }

    const name = req.body.name.toLowerCase();
    const pass = req.body.pass;


    let user = accountStore.get(`users.${name}`);
    if (user) {
        res.status(401).send({msg: `User '${req.body.name}' is already a registered user.`});
        return;
    }

    bcrypt.hash(pass, saltRounds, (err, hash) => {
        accountStore.set(`users.${name}`, {
            passwordHash: hash,
            data: req.body.data
        });
        res.send({data: userFilter(accountStore.get(`users.${name}`)), status: 'Successfully made account'});
    });

});


async function checkUser(username, password) {
    const user = accountStore.get(`users.${username}`);
    return await bcrypt.compare(password, user.passwordHash);
}