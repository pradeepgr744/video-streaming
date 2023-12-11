const asyncHandler = (requestHandeler) => {
   return (req, res, next) => {
        Promise.resolve(requestHandeler(req, res, next))
        .catch((err) => next(err));
    }
}



export { asyncHandler }




// const asyncHandler = (fn) => (req, res, next) => { 
// try {
//     await fn(req, res, next);
// } catch (error) {
//     res.status(err.code || 500).json({
//         success: false,
//         message: err.message
//     })
// }


// const asyncHandler = () => { }
// const asyncHandler = (func) => () => { }
// const asyncHandler = (func) => async () => { }