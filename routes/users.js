var express = require('express');
var router = express.Router();
var csrf = require('csurf');
var passport = require('passport');
var User = require('../models/user');
var svgCaptcha = require('svg-captcha');
var Order = require('../models/order');

var csrfPro = csrf();
router.use(csrfPro);

//Loggin-In functions
router.get('/signout', isLoggedIn, function(req, res, next){
  req.logout();
  res.redirect('/');
});

router.get('/profile', isLoggedIn, function(req, res, next){
  res.render('users/profile',{title: 'Tài khoản', userInfo: req.user});
});

router.get('/edit-info', isLoggedIn, function(req, res, next){
  var msg = req.flash('error');
  res.render('users/edit-info',{title: 'Sửa thông tin cá nhân', csrfToken: req.csrfToken(), msg: msg, userInfo: req.user});
});

router.post('/edit-info', isLoggedIn, function(req, res, next){
  req.checkBody('name', 'Tên người dùng không được trống.').notEmpty();
  req.checkBody('phone', 'Số điện thoại không được trống.').notEmpty();
  req.checkBody('addr', 'Địa chỉ không được trống.').notEmpty();
  var id = req.body.id;
  var errors = req.validationErrors();
  if (errors){
      var emsg = [];
      errors.forEach(function(error){
          emsg.push(error.msg);
      });
      return res.render('users/edit-info',{title: 'Sửa thông tin cá nhân', csrfToken: req.csrfToken(), msg: emsg[0]});
  }
  var name = req.body.name;
  var phone = req.body.phone;
  var addr = req.body.addr;
  User.findById(id, function (err, doc) {
    if (err){
      return res.render('users/edit-info',{title: 'Sửa thông tin cá nhân', csrfToken: req.csrfToken(), msg: err});
    }
    doc.name = name;
    doc.phone = phone;
    doc.addr = addr;
    doc.save(function(){
      res.redirect('/users/profile');
    });
  });
});

router.get('/change-password', isLoggedIn, function(req, res, next){
  var msg = req.flash('error');
  res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: msg});
});

router.post('/change-password', isLoggedIn, function(req, res, next){
  req.checkBody('oldpass', 'Mật khẩu không hợp lệ.').notEmpty().isLength({min: 4});
  req.checkBody('newpass', 'Mật khẩu không hợp lệ.').notEmpty().isLength({min: 4});
  req.checkBody('repass', 'Mật khẩu không hợp lệ.').notEmpty().isLength({min: 4});
  var id = req.user._id;
  var errors = req.validationErrors();
  if (errors){
      var emsg = [];
      errors.forEach(function(error){
          emsg.push(error.msg);
      });
      return res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: emsg[0]});
  }
  var oldpass = req.body.oldpass;
  var newpass = req.body.newpass;
  var repass = req.body.repass;
  if (newpass != repass){
    return res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: 'Xác nhận không chính xác.'});
  }
  User.findById(id, function (err, doc) {
    if (err){
      return res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: err});
    }
    if (!doc.validPassword(oldpass)){
      return res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: 'Mật khẩu không chính xác.'});
    }
    var encryptMachine = new User;
    var encPass = encryptMachine.encryptPassword(newpass);
    doc.password = encPass;
    
    doc.save(function(err, user){
      if (err){
        return res.render('users/change-password',{title: 'Đổi mật khẩu', csrfToken: req.csrfToken(), msg: err});
      }
      return res.redirect('/users/profile');
    });
  });
});

router.get('/view-order-list', isLoggedIn, function(req, res, next){
  Order.find({user: req.user}).sort({added: -1}).exec(function(err, doc){
    if (err){
      return res.render('error', {message: err});
    }
    return res.render('users/order-list', {title: 'Danh sách dơn hàng', orders: doc});
  });
});

router.get('/view-order-detail/:id', isLoggedIn, function(req, res, next){
  var orderid = req.params.id;
  Order.findOne({_id: orderid, user: req.user}).exec(function(err, doc){
    if (err){
      return res.render('error', {message: err});
    }
    if (doc.status == 1)
      return res.render('users/order-detail', {title: 'Chi tiết đơn hàng', order: doc, orderstatus: 'Đang xử lí', cancelable: true});
    if (doc.status > 1)
      return res.render('users/order-detail', {title: 'Chi tiết đơn hàng', order: doc, orderstatus: 'Hoàn thành', cancelable: false});
    if (doc.status < 1)
      return res.render('users/order-detail', {title: 'Chi tiết đơn hàng', order: doc, orderstatus: 'Bị hủy', cancelable: false});
  });
});

router.get('/cancel-order/:id', isLoggedIn, function(req, res, next){
  var orderid = req.params.id;
  Order.findOne({_id: orderid, user: req.user}).exec(function(err, doc){
    if (err){
      return res.render('error', {message: err});
    }
    doc.status = 0;
    doc.save(function(err, doc){
      if (err){
        return res.render('error', {message: err});
      }
      return res.redirect('/users/view-order-list');
    });
  });
});

//Not-Logged-In functions
router.use('/', notLoggedIn, function(req, res, next){
  next();
});

router.get('/signup', function(req, res, next) {
  var msg = req.flash('error');
  var captcha = svgCaptcha.create();
  req.session.capt = captcha.text;
  res.render('users/signup', { title: 'Đăng kí', csrfToken: req.csrfToken(), msg: msg, captchaImg: captcha.data});
});

router.post('/signup', passport.authenticate('local.signup',{
  failureRedirect: '/users/signup',
  failureFlash: true
}), function(req, res, next){
  if (req.session.oldUrl){
    var oldUrl = req.session.oldUrl;
    req.session.oldUrl = null;
    res.redirect(oldUrl); 
  } else {
    res.redirect('/');
  }
});
router.get('/signin', function(req, res, next) {
  var msg = req.flash('error');
  res.render('users/signin', { title: 'Đăng nhập', csrfToken: req.csrfToken(), msg: msg});
});

router.post('/signin', passport.authenticate('local.signin',{
  failureRedirect: '/users/signin',
  failureFlash: true
}), function(req, res, next){
  if (req.session.oldUrl){
    var oldUrl = req.session.oldUrl;
    req.session.oldUrl = null;
    res.redirect(oldUrl); 
  } else {
    res.redirect('/');
  }
});

module.exports = router;

function isLoggedIn(req, res, next){
  if (req.isAuthenticated()){
    return next();
  }
  req.session.oldUrl = req.url;
  res.redirect('/users/signin');
}

function notLoggedIn(req, res, next){
  if (!req.isAuthenticated()){
    return next();
  }
  res.redirect('/users/signin');
}

