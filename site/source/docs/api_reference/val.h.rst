.. _val-h:

=====
val.h
=====

The *Embind* C++ class :cpp:class:`emscripten::val` (defined in `val.h <https://github.com/emscripten-core/emscripten/blob/main/system/include/emscripten/val.h>`_) is used to *transliterate* JavaScript code to C++.

Guide material for this class can be found in :ref:`embind-val-guide`.


.. cpp:namespace:: emscripten

.. cpp:class:: emscripten::val

  This class is a C++ data type that can be used to represent (and provide convenient access to) any JavaScript object. You can use it to call a JavaScript object, read and write its properties, or coerce it to a C++ value like a ``bool``, ``int``, or ``std::string``.

  For example, the code below shows some simple JavaScript for making an XHR request on a URL:

  .. code:: javascript

    var xhr = new XMLHttpRequest;
    xhr.open("GET", "http://url");


  This same code can be written in C++, using :cpp:func:`~emscripten::val::global` to get the symbol for the global ``XMLHttpRequest`` object and then using it to open a URL.


  .. code:: cpp

    val xhr = val::global("XMLHttpRequest").new_();
    xhr.call<void>("open", std::string("GET"), std::string("http://url"));

  You can test whether the ``open`` method call was successful using :cpp:func:`~emscripten::val::operator[]` to read an object property, then :cpp:func:`~emscripten::val::as` to coerce the type:

  .. code:: cpp

    const char* state;
    switch (xhr["readyState"].as<int>()) {
    case 0:
      state = "UNSENT"; break;
    case 1:
      state = "OPENED"; break;
    default:
      state = "etc";
    }

  See :ref:`embind-val-guide` for other examples.
  

  .. warning:: JavaScript values can't be shared across threads, so neither can ``val`` instances that bind them.
    
    For example, if you want to cache some JavaScript global as a ``val``, you need to retrieve and bind separate instances of that global by its name in each thread.
    The easiest way to do this is with a ``thread_local`` declaration:

    .. code:: cpp

      thread_local const val Uint8Array = val::global("Uint8Array");

  .. todo::

    **HamishW** Notes from source FYI: Can/should these be included? ::

      // missing operators:
      // * delete
      // * in
      // * instanceof
      // * ! ~ - + ++ --
      // * * / %
      // * + -
      // * << >> >>>
      // * < <= > >=
      // * == != === !==
      // * & ^ | && || ?:
      //
      // exposing void, comma, and conditional is unnecessary
      // same with: = += -= *= /= %= <<= >>= >>>= &= ^= |=


  .. cpp:function:: static val array()

    Creates and returns a new ``Array``.


  .. cpp:function:: static val object()

    Creates and returns a new ``Object``.


  .. cpp:function:: static val undefined()

    Creates a ``val`` that represents ``undefined``.


  .. cpp:function:: static val null()

    Creates a ``val`` that represents ``null``.


  .. cpp:function:: static val global(const char* name)

    Looks up a global value by the specified ``name``.



  .. cpp:function:: static val module_property(const char* name)

    Looks up a value by the provided ``name`` on the Emscripten Module object.


  .. cpp:function:: explicit val(T&& value)

    Constructor.

    Creates a ``val`` by conversion from any Embind-compatible C++ type.
    For example, ``val(true)`` or ``val(std::string("foo"))``.


  .. cpp:function:: explicit val(const char* v)

    Constructs a ``val`` instance from a string literal.


  .. cpp:function:: val(val&& v)
    
    Moves ownership of a value to a new ``val`` instance.


  .. cpp:function:: val(const val& v)
    
    Creates another reference to the same value behind the provided ``val`` instance.


  .. cpp:function:: ~val()

    Removes the currently bound value by decreasing its refcount.


  .. cpp:function:: val& operator=(val&& v)
    
    Removes a reference to the currently bound value and takes over the provided one.


  .. cpp:function:: val& operator=(const val& v)

    Removes a reference to the currently bound value and creates another reference to
    the value behind the provided ``val`` instance.


  .. cpp:function:: bool hasOwnProperty(const char* key) const

    Checks if the JavaScript object has own (non-inherited) property with the specified name.


  .. cpp:function:: val new_(Args&&... args) const

    Assumes that current value is a constructor, and creates an instance of it.
    Equivalent to a JavaScript expression `new currentValue(...)`.



  .. cpp:function:: val operator[](const T& key) const

    Get the specified (``key``) property of a JavaScript object.


  .. cpp:function:: void set(const K& key, const val& v)

    Set the specified (``key``) property of a JavaScript object (accessed through a ``val``) with the value ``v``.


  .. cpp:function:: val operator()(Args&&... args) const
    
    Assumes that current value is a function, and invokes it with provided arguments.


  .. cpp:function:: ReturnValue call(const char* name, Args&&... args) const

    Invokes the specified method (``name``) on the current object with provided arguments.


  .. cpp:function:: T as() const

    Converts current value to the specified C++ type.


  .. cpp:function:: val typeof() const

    Returns the result of a JavaScript ``typeof`` operator invoked on the current value.


  .. cpp:function:: std::vector<T> vecFromJSArray(const val& v)

    Copies a JavaScript array into a ``std::vector<T>``, converting each element via ``.as<T>()``.
    For a more efficient but unsafe version working with numbers, see ``convertJSArrayToNumberVector``.

    :param val v: The JavaScript array to be copied
    :returns: A ``std::vector<T>`` made from the javascript array

  .. cpp:function:: std::vector<T> convertJSArrayToNumberVector(const val& v)

    Converts a JavaScript array into a ``std::vector<T>`` efficiently, as if using the javascript `Number()` function on each element.
    This is way more efficient than ``vecFromJSArray`` on any array with more than 2 values, but is not suitable for arrays of non-numeric values.
    No type checking is done, so any invalid array entry will silently be replaced by a NaN value (or 0 for integer types).

    :param val v: The JavaScript (typed) array to be copied
    :returns: A std::vector<T> made from the javascript array


  .. cpp:function:: val await() const

    Pauses the C++ to ``await`` the ``Promise`` / thenable.

    :returns: The fulfilled value.

      .. note:: This method requires :ref:`Asyncify` to be enabled.


.. cpp:type: EMSCRIPTEN_SYMBOL(name)

  **HamishW**-Replace with description.
